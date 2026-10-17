import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { competenciaId } from "@/lib/daily-reward-competencia";
import { dailyRewardCompetenciaSchema } from "@/lib/validations/admin/daily-reward";
import { withAudit } from "@/lib/api-audit-wrapper";

type CompetenciaSummary = {
  year: number;
  month: number;
  rewardCount: number;
  bonusCount: number;
  previewItemIds: number[];
};

export const GET = withAudit(async function GET() {
  const { response } = await requireAdminSession();
  if (response) return response;

  const [rewards, bonusRewards] = await Promise.all([
    prisma.dailyRewardsMonthly.findMany({ orderBy: [{ day: "asc" }] }),
    prisma.dailyRewardsBonusMonthly.findMany({ orderBy: [{ streakDay: "asc" }] }),
  ]);

  const byKey = new Map<string, CompetenciaSummary>();

  function summaryFor(year: number, month: number): CompetenciaSummary {
    const key = `${year}-${month}`;
    let summary = byKey.get(key);
    if (!summary) {
      summary = { year, month, rewardCount: 0, bonusCount: 0, previewItemIds: [] };
      byKey.set(key, summary);
    }
    return summary;
  }

  for (const reward of rewards) {
    const summary = summaryFor(reward.year, reward.month);
    summary.rewardCount += 1;
    if (summary.previewItemIds.length < 6) summary.previewItemIds.push(reward.itemId);
  }
  for (const reward of bonusRewards) {
    const summary = summaryFor(reward.year, reward.month);
    summary.bonusCount += 1;
    if (summary.previewItemIds.length < 6) summary.previewItemIds.push(reward.itemId);
  }

  const competencias = [...byKey.values()].sort((a, b) => b.year - a.year || b.month - a.month);

  return NextResponse.json({ competencias });
});

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const body = await request.json();
  const parsed = dailyRewardCompetenciaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const { month, year, rewards, bonusRewards } = parsed.data;

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

  await prisma.$transaction([
    prisma.dailyRewardsMonthly.createMany({
      data: rewards.map((reward) => ({ month, year, ...reward })),
    }),
    prisma.dailyRewardsBonusMonthly.createMany({
      data: bonusRewards.map((reward) => ({ month, year, ...reward })),
    }),
  ]);

  await logAudit({
    accountId: Number(session.user.id),
    action: "create",
    entity: "daily_rewards_competencia",
    entityId: competenciaId(year, month),
    metadata: { rewardCount: rewards.length, bonusCount: bonusRewards.length },
  });

  return NextResponse.json({ id: competenciaId(year, month), year, month }, { status: 201 });
});
