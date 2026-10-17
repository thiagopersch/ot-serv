import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { buildPaginatedResult, parsePaginationParams } from "@/lib/pagination";
import { chestSchema, MAX_CHESTS } from "@/lib/validations/admin/chest";
import { withAudit } from "@/lib/api-audit-wrapper";

/** Resolve um termo de busca (nome ou id numérico) para uma lista de ids de item —
 * usado pelos filtros "Item-chave" e "Nome ou ID da recompensa", que precisam casar
 * contra `keyItemId`/`rewards` (json) a partir de texto livre. */
async function resolveItemIds(term: string): Promise<number[]> {
  const numericId = Number(term);
  const rows = await prisma.item.findMany({
    where: {
      OR: [
        { name: { contains: term } },
        ...(Number.isFinite(numericId) ? [{ id: numericId }] : []),
      ],
    },
    select: { id: true },
    take: 500,
  });
  return rows.map((row) => row.id);
}

export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const url = new URL(request.url);
  const { page, pageSize, search } = parsePaginationParams(url);
  const publishedParam = url.searchParams.get("published");
  const keyItemTerm = url.searchParams.get("keyItem");
  const rewardTerm = url.searchParams.get("reward");

  const [keyItemIds, rewardItemIds] = await Promise.all([
    keyItemTerm ? resolveItemIds(keyItemTerm) : null,
    rewardTerm ? resolveItemIds(rewardTerm) : null,
  ]);

  const where = {
    ...(search ? { name: { contains: search } } : {}),
    ...(publishedParam === "true" || publishedParam === "false"
      ? { published: publishedParam === "true" }
      : {}),
    ...(keyItemIds ? { keyItemId: { in: keyItemIds } } : {}),
  };

  const allMatching = await prisma.chest.findMany({ where, orderBy: { id: "asc" } });

  const filtered = rewardItemIds
    ? allMatching.filter((chest) => {
        const rewards = chest.rewards as { itemId: number; count: number }[];
        return rewards.some((reward) => rewardItemIds.includes(reward.itemId));
      })
    : allMatching;

  const total = filtered.length;
  const chests = filtered.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

  return NextResponse.json(buildPaginatedResult(chests, total, page, pageSize));
});

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const body = await request.json();
  const parsed = chestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const existingCount = await prisma.chest.count();
  if (existingCount >= MAX_CHESTS) {
    return NextResponse.json(
      { error: `O sistema de baús do OTC exibe no máximo ${MAX_CHESTS} baús (1 central + 2 laterais).` },
      { status: 422 },
    );
  }

  const chest = await prisma.chest.create({
    data: {
      name: parsed.data.name,
      keyItemId: parsed.data.keyItemId,
      rewards: parsed.data.rewards,
      startMonth: parsed.data.startMonth,
      startYear: parsed.data.startYear,
      endMonth: parsed.data.endMonth,
      endYear: parsed.data.endYear,
      published: parsed.data.published,
    },
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "create",
    entity: "chest",
    entityId: chest.id,
    metadata: { name: chest.name },
  });

  return NextResponse.json({ chest }, { status: 201 });
});
