import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { buildPaginatedResult, parsePaginationParams } from "@/lib/pagination";
import { borderFormSchema } from "@/lib/validations/admin/border";
import { borderItemIds, idsWithItem } from "@/lib/brush-item-ids";
import type { BorderEdgeItemInput } from "@/lib/validations/admin/border";
import { hasDuplicateName } from "@/lib/unique-name";
import { withAudit } from "@/lib/api-audit-wrapper";

/** Teto de segurança para `all=true` — bem acima do que `borders.xml` real chega a ter,
 * só para não deixar a query totalmente sem limite. */
const ALL_BORDERS_CAP = 2000;

function parseBooleanParam(value: string | null): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

/** `true` se ao menos um dos 12 slots de `edges` tiver um `itemId` configurado (> 0) —
 * usado pelo filtro "possui edges configurados", já que muitos borders cadastrados são
 * apenas o esqueleto vazio (12 slots com itemId=0) ainda não preenchido. */
function hasConfiguredEdge(edges: unknown): boolean {
  return ((edges as BorderEdgeItemInput[] | null) ?? []).some((edge) => edge.itemId > 0);
}

/** Sprite de pré-visualização da listagem: canto diagonal noroeste (dnw), senão leste (e),
 * senão norte (n), senão sul (s) — o primeiro desses 4 edges com um item configurado. */
function previewItemId(edges: unknown): number | null {
  const list = (edges as BorderEdgeItemInput[] | null) ?? [];
  for (const edgeName of ["dnw", "e", "n", "s"] as const) {
    const itemId = list.find((edge) => edge.edge === edgeName)?.itemId;
    if (itemId != null && itemId > 0) return itemId;
  }
  return null;
}

export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const url = new URL(request.url);
  const { page, pageSize, search } = parsePaginationParams(url);
  // Usado pelo combobox "Border" do form de Ground: esse campo precisa da lista completa
  // para buscar/selecionar por nome ou id, não de uma página — o `pageSize` normal é
  // limitado a 200 (`paginationQuerySchema`), o que já cortou borders reais (havia mais
  // de 200 cadastrados) fora da lista.
  const all = url.searchParams.get("all") === "true";

  const optional = parseBooleanParam(url.searchParams.get("optional"));
  const group = url.searchParams.get("group");
  const edgesConfigured = parseBooleanParam(url.searchParams.get("edgesConfigured"));

  const searchId = search ? Number(search) : NaN;
  const isNumericSearch = search !== "" && Number.isFinite(searchId);

  // Busca por id de item: cada `edge` do border referencia um item (`borderitem`) — não dá
  // pra filtrar isso no banco (JSON aninhado), então varre a tabela em memória.
  let contentMatchIds: number[] = [];
  if (isNumericSearch) {
    const candidates = await prisma.border.findMany({ select: { id: true, edges: true } });
    contentMatchIds = idsWithItem(candidates, borderItemIds, searchId);
  }

  // Filtro "possui edges configurados": mesma limitação de JSON aninhado — varre a
  // tabela em memória.
  let edgesConfiguredMatchIds: number[] | null = null;
  if (edgesConfigured !== undefined) {
    const candidates = await prisma.border.findMany({ select: { id: true, edges: true } });
    edgesConfiguredMatchIds = candidates
      .filter((row) => hasConfiguredEdge(row.edges) === edgesConfigured)
      .map((row) => row.id);
  }

  const where: Prisma.BorderWhereInput = {
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            ...(isNumericSearch ? [{ id: { in: contentMatchIds } }] : []),
          ],
        }
      : {}),
    ...(optional !== undefined ? { optional } : {}),
    ...(group ? { group: Number(group) } : {}),
    ...(edgesConfiguredMatchIds ? { id: { in: edgesConfiguredMatchIds } } : {}),
  };
  const skip = all ? 0 : (page - 1) * pageSize;
  const take = all ? ALL_BORDERS_CAP : pageSize;

  const [rows, total] = await Promise.all([
    prisma.border.findMany({
      where,
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        group: true,
        optional: true,
        updatedAt: true,
        edges: true,
      },
      skip,
      take,
    }),
    prisma.border.count({ where }),
  ]);

  const borders = rows.map(({ edges, ...row }) => ({
    ...row,
    ...(all ? { edges } : {}),
    previewItemId: previewItemId(edges),
  }));

  return NextResponse.json(
    all ? buildPaginatedResult(borders, total, 1, Math.max(total, 1)) : buildPaginatedResult(borders, total, page, pageSize)
  );
});

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const body = await request.json();
  const parsed = borderFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const existing = await prisma.border.findUnique({ where: { id: parsed.data.id } });
  if (existing) {
    return NextResponse.json({ error: "Já existe um border com esse id." }, { status: 409 });
  }

  const existingNames = await prisma.border.findMany({ select: { id: true, name: true } });
  if (hasDuplicateName(existingNames, parsed.data.name)) {
    return NextResponse.json({ error: "Já existe um border com esse nome." }, { status: 409 });
  }

  const border = await prisma.border.create({
    data: {
      id: parsed.data.id,
      name: parsed.data.name,
      group: parsed.data.group,
      optional: parsed.data.optional,
      edges: parsed.data.edges,
    },
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "create",
    entity: "border",
    entityId: border.id,
    metadata: { name: border.name },
  });

  return NextResponse.json({ border }, { status: 201 });
});
