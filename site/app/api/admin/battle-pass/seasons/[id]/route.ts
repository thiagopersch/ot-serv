import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { syncActiveSeason } from "@/lib/battle-pass-season";
import { battlePassSeasonSchema, validateRewardsOrdering } from "@/lib/validations/admin/battle-pass";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const GET = withAudit(async function GET(_request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const season = await prisma.battlePassSeason.findUnique({
    where: { id: Number(id) },
    include: {
      missions: { orderBy: { id: "asc" } },
      rewards: { orderBy: [{ track: "asc" }, { level: "asc" }, { order: "asc" }] },
    },
  });

  if (!season) {
    return NextResponse.json({ error: "Temporada não encontrada." }, { status: 404 });
  }

  return NextResponse.json({ season });
});

export const PATCH = withAudit(async function PATCH(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const seasonId = Number(id);

  const body = await request.json();
  const parsed = battlePassSeasonSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 422 },
    );
  }

  const { month, year, missions, rewards, ...seasonFields } = parsed.data;

  const orderingError = validateRewardsOrdering(rewards);
  if (orderingError) {
    return NextResponse.json({ error: orderingError }, { status: 422 });
  }

  const conflict = await prisma.battlePassSeason.findUnique({ where: { month_year: { month, year } } });
  if (conflict && conflict.id !== seasonId) {
    return NextResponse.json({ error: "Já existe uma temporada para esse mês/ano." }, { status: 409 });
  }

  const season = await prisma.$transaction(async (tx) => {
    await tx.battlePassMission.deleteMany({ where: { seasonId } });
    await tx.battlePassReward.deleteMany({ where: { seasonId } });

    return tx.battlePassSeason.update({
      where: { id: seasonId },
      data: {
        month,
        year,
        ...seasonFields,
        missions: {
          create: missions.map((mission) => ({
            ...mission,
            target: mission.target as unknown as Prisma.InputJsonValue,
          })),
        },
        rewards: { create: rewards },
      },
    });
  });

  await syncActiveSeason();

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "battle_pass_season",
    entityId: season.id,
    metadata: { month, year },
  });

  return NextResponse.json({ season });
});

export const DELETE = withAudit(async function DELETE(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  await prisma.battlePassSeason.delete({ where: { id: Number(id) } });

  await logAudit({
    accountId: Number(session.user.id),
    action: "delete",
    entity: "battle_pass_season",
    entityId: id,
  });

  return NextResponse.json({ success: true });
});
