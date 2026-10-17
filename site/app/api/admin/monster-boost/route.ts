import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { buildPaginatedResult, parsePaginationParams } from "@/lib/pagination";
import { monsterBoostSchema } from "@/lib/validations/admin/monster-boost";
import { withAudit } from "@/lib/api-audit-wrapper";

export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const url = new URL(request.url);
  const { page, pageSize, search } = parsePaginationParams(url);

  const where: Prisma.MonsterBoostWhereInput = search ? { monster: { contains: search } } : {};

  const [monsterBoosts, total] = await Promise.all([
    prisma.monsterBoost.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.monsterBoost.count({ where }),
  ]);

  return NextResponse.json(buildPaginatedResult(monsterBoosts, total, page, pageSize));
});

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const body = await request.json();
  const parsed = monsterBoostSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const monsterBoost = await prisma.monsterBoost.create({ data: parsed.data });

  await logAudit({
    accountId: Number(session.user.id),
    action: "create",
    entity: "monster_boost",
    entityId: monsterBoost.id,
    metadata: parsed.data,
  });

  return NextResponse.json({ monsterBoost }, { status: 201 });
});
