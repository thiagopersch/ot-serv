import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { buildPaginatedResult, parsePaginationParams } from "@/lib/pagination";
import { npcSchema } from "@/lib/validations/admin/npc";
import { writeNpcFiles } from "@/lib/npc-generator";
import { reconcileNpcsFromDisk } from "@/lib/npc-file-sync";
import { withAudit } from "@/lib/api-audit-wrapper";

const NPC_LIST_INCLUDE = {
  script: true,
  category: { select: { id: true, name: true, color: true } },
} as const;

/** Item de `Npc.shopItems` — o JSON aceita tanto o formato atual (`normalizeShopItems`) quanto o
 * legado documentado no schema (`buyPriceCrystal`/`sellPriceCrystal`); só `name`/`itemId`
 * importam pra busca, e ambos os formatos têm essas duas chaves. */
type ShopItemLike = { itemId?: number; name?: string };

function shopItemsMatch(shopItems: unknown, query: string, queryAsNumber: number | null): boolean {
  if (!Array.isArray(shopItems)) return false;
  return (shopItems as ShopItemLike[]).some((item) => {
    if (queryAsNumber != null && item.itemId === queryAsNumber) return true;
    return typeof item.name === "string" && item.name.toLowerCase().includes(query);
  });
}

export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const url = new URL(request.url);
  const { page, pageSize, search } = parsePaginationParams(url);

  const type = url.searchParams.get("type");
  const direction = url.searchParams.get("direction");
  const lookAddons = url.searchParams.get("lookAddons");
  const categoryId = url.searchParams.get("categoryId");
  const published = url.searchParams.get("published");

  const where: Prisma.NpcWhereInput = {
    ...(type ? { type } : {}),
    ...(direction ? { direction: Number(direction) } : {}),
    ...(lookAddons ? { lookAddons: Number(lookAddons) } : {}),
    ...(categoryId ? { categoryId: Number(categoryId) } : {}),
    ...(published ? { published: published === "true" } : {}),
  };

  const trimmedSearch = search.trim();

  // A busca livre precisa casar contra o número da looktype (`Looktype.looktypeNumber`, que não
  // é uma relação direta de `Npc.lookTypeId`) e contra nome/id de item dentro do JSON
  // `shopItems` — nenhum dos dois dá pra expressar num `where` do Prisma, então pagina em
  // memória (mesmo padrão de `app/api/admin/monsters/route.ts` pra loot/attacks).
  if (trimmedSearch) {
    const searchLower = trimmedSearch.toLowerCase();
    const searchAsNumber = Number.isFinite(Number(trimmedSearch)) ? Number(trimmedSearch) : null;

    const candidates = await prisma.npc.findMany({
      where,
      include: NPC_LIST_INCLUDE,
      orderBy: { name: "asc" },
      take: 2000,
    });

    const lookTypeIds = [...new Set(candidates.map((npc) => npc.lookTypeId))];
    const looktypes = lookTypeIds.length
      ? await prisma.looktype.findMany({
          where: { id: { in: lookTypeIds } },
          select: { id: true, looktypeNumber: true },
        })
      : [];
    const looktypeNumberById = new Map(looktypes.map((lt) => [lt.id, lt.looktypeNumber]));

    const filtered = candidates.filter((npc) => {
      if (npc.name.toLowerCase().includes(searchLower)) return true;
      if (searchAsNumber != null && looktypeNumberById.get(npc.lookTypeId) === searchAsNumber) return true;
      return shopItemsMatch(npc.shopItems, searchLower, searchAsNumber);
    });

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const pageItems = await reconcileNpcsFromDisk(filtered.slice(start, start + pageSize));

    return NextResponse.json(buildPaginatedResult(pageItems, total, page, pageSize));
  }

  const [found, total] = await Promise.all([
    prisma.npc.findMany({
      where,
      include: NPC_LIST_INCLUDE,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.npc.count({ where }),
  ]);

  // Reconcilia com data/npc/{nome}.xml antes de responder — pega edições feitas direto no
  // arquivo (manuais ou pelo Explorador de arquivos) sem depender de importação manual.
  const npcs = await reconcileNpcsFromDisk(found);

  return NextResponse.json(buildPaginatedResult(npcs, total, page, pageSize));
});

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const body = await request.json();
  const parsed = npcSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const { shopItems, customMessages, defaultMessages, ...npcFields } = parsed.data;

  const npc = await prisma.npc.create({
    data: {
      ...npcFields,
      shopItems: shopItems.filter((item) => item.direction && item.itemId) as unknown as Prisma.InputJsonValue,
      customMessages: customMessages as unknown as Prisma.InputJsonValue,
      defaultMessages: defaultMessages as unknown as Prisma.InputJsonValue,
    },
  });

  try {
    await writeNpcFiles(parsed.data);
  } catch (error) {
    return NextResponse.json(
      { npc, warning: `NPC salvo no banco, mas falhou ao gravar os arquivos: ${String(error)}` },
      { status: 201 },
    );
  }

  await logAudit({
    accountId: Number(session.user.id),
    action: "create",
    entity: "npc",
    entityId: npc.id,
    metadata: { name: npc.name, type: npc.type },
  });

  return NextResponse.json({ npc }, { status: 201 });
});
