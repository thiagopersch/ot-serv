import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { parseCompetenciaParam, competenciaId } from "@/lib/daily-reward-competencia";
import { dailyRewardCompetenciaSchema } from "@/lib/validations/admin/daily-reward";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ competencia: string }> };

export const GET = withAudit(async function GET(_request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const parsedParam = parseCompetenciaParam((await params).competencia);
  if (!parsedParam) return NextResponse.json({ error: "Competência inválida." }, { status: 400 });
  const { year, month } = parsedParam;

  const [rewards, bonusRewards] = await Promise.all([
    prisma.dailyRewardsMonthly.findMany({ where: { year, month }, orderBy: { day: "asc" } }),
    prisma.dailyRewardsBonusMonthly.findMany({ where: { year, month }, orderBy: { streakDay: "asc" } }),
  ]);

  if (rewards.length === 0 && bonusRewards.length === 0) {
    return NextResponse.json({ error: "Competência não encontrada." }, { status: 404 });
  }

  return NextResponse.json({
    year,
    month,
    rewards: rewards.map((r) => ({ day: r.day, itemId: r.itemId, clientId: r.clientId, count: r.count })),
    bonusRewards: bonusRewards.map((r) => ({
      streakDay: r.streakDay,
      itemId: r.itemId,
      clientId: r.clientId,
      count: r.count,
    })),
  });
});

export const PUT = withAudit(async function PUT(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const parsedParam = parseCompetenciaParam((await params).competencia);
  if (!parsedParam) return NextResponse.json({ error: "Competência inválida." }, { status: 400 });
  const { year: originalYear, month: originalMonth } = parsedParam;

  const body = await request.json();
  const parsed = dailyRewardCompetenciaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const { month, year, rewards, bonusRewards } = parsed.data;
  const isRename = month !== originalMonth || year !== originalYear;

  if (isRename) {
    const [existingReward, existingBonus] = await Promise.all([
      prisma.dailyRewardsMonthly.findFirst({ where: { month, year } }),
      prisma.dailyRewardsBonusMonthly.findFirst({ where: { month, year } }),
    ]);
    if (existingReward || existingBonus) {
      return NextResponse.json(
        { error: `Já existe uma competência cadastrada para ${String(month).padStart(2, "0")}/${year}.` },
        { status: 409 },
      );
    }
  }

  await prisma.$transaction([
    prisma.dailyRewardsMonthly.deleteMany({ where: { month: originalMonth, year: originalYear } }),
    prisma.dailyRewardsBonusMonthly.deleteMany({ where: { month: originalMonth, year: originalYear } }),
    prisma.dailyRewardsMonthly.createMany({
      data: rewards.map((reward) => ({ month, year, ...reward })),
    }),
    prisma.dailyRewardsBonusMonthly.createMany({
      data: bonusRewards.map((reward) => ({ month, year, ...reward })),
    }),
  ]);

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "daily_rewards_competencia",
    entityId: competenciaId(year, month),
    metadata: { rewardCount: rewards.length, bonusCount: bonusRewards.length },
  });

  return NextResponse.json({ id: competenciaId(year, month), year, month });
});

export const DELETE = withAudit(async function DELETE(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const parsedParam = parseCompetenciaParam((await params).competencia);
  if (!parsedParam) return NextResponse.json({ error: "Competência inválida." }, { status: 400 });
  const { year, month } = parsedParam;

  await prisma.$transaction([
    prisma.dailyRewardsMonthly.deleteMany({ where: { month, year } }),
    prisma.dailyRewardsBonusMonthly.deleteMany({ where: { month, year } }),
  ]);

  await logAudit({
    accountId: Number(session.user.id),
    action: "delete",
    entity: "daily_rewards_competencia",
    entityId: competenciaId(year, month),
  });

  return NextResponse.json({ success: true });
});
