import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import {
  bonusMilestones,
  competenciaId,
  daysInMonth,
  parseCompetenciaParam,
} from "@/lib/daily-reward-competencia";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ competencia: string }> };

/** Acha o próximo mês/ano livre a partir do mês seguinte ao de origem — evita colidir com a PK
 * composta `[month, year, day]` / `[month, year, streakDay]` (mesmo padrão de
 * `lib/battle-pass-season.ts`). */
async function nextFreeMonthYear(month: number, year: number) {
  let nextMonth = month;
  let nextYear = year;

  for (let i = 0; i < 24; i++) {
    nextMonth += 1;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    const [existingReward, existingBonus] = await Promise.all([
      prisma.dailyRewardsMonthly.findFirst({ where: { month: nextMonth, year: nextYear } }),
      prisma.dailyRewardsBonusMonthly.findFirst({ where: { month: nextMonth, year: nextYear } }),
    ]);
    if (!existingReward && !existingBonus) return { month: nextMonth, year: nextYear };
  }

  throw new Error("Não foi possível encontrar um mês/ano livre para duplicar.");
}

export const POST = withAudit(async function POST(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const parsedParam = parseCompetenciaParam((await params).competencia);
  if (!parsedParam) return NextResponse.json({ error: "Competência inválida." }, { status: 400 });
  const { year: sourceYear, month: sourceMonth } = parsedParam;

  const [rewards, bonusRewards] = await Promise.all([
    prisma.dailyRewardsMonthly.findMany({ where: { year: sourceYear, month: sourceMonth } }),
    prisma.dailyRewardsBonusMonthly.findMany({ where: { year: sourceYear, month: sourceMonth } }),
  ]);
  if (rewards.length === 0 && bonusRewards.length === 0) {
    return NextResponse.json({ error: "Competência não encontrada." }, { status: 404 });
  }

  const { month, year } = await nextFreeMonthYear(sourceMonth, sourceYear);

  // O mês de destino pode ser mais curto (ex.: janeiro → fevereiro): descarta dias que não
  // existem e move o último marco bonus (30 ↔ 28 em fevereiro) para o marco do mês de destino.
  const maxDay = daysInMonth(year, month);
  const sourceLastMilestone = bonusMilestones(sourceMonth).at(-1);
  const targetLastMilestone = bonusMilestones(month).at(-1)!;
  const usedStreakDays = new Set<number>();
  const targetBonus = bonusRewards
    .map((r) => ({
      ...r,
      streakDay: r.streakDay === sourceLastMilestone ? targetLastMilestone : r.streakDay,
    }))
    .filter((r) => {
      if (r.streakDay > maxDay || usedStreakDays.has(r.streakDay)) return false;
      usedStreakDays.add(r.streakDay);
      return true;
    });

  await prisma.$transaction([
    prisma.dailyRewardsMonthly.createMany({
      data: rewards
        .filter((r) => r.day <= maxDay)
        .map((r) => ({ month, year, day: r.day, itemId: r.itemId, clientId: r.clientId, count: r.count })),
    }),
    prisma.dailyRewardsBonusMonthly.createMany({
      data: targetBonus.map((r) => ({
        month,
        year,
        streakDay: r.streakDay,
        itemId: r.itemId,
        clientId: r.clientId,
        count: r.count,
      })),
    }),
  ]);

  await logAudit({
    accountId: Number(session.user.id),
    action: "duplicate",
    entity: "daily_rewards_competencia",
    entityId: competenciaId(year, month),
    metadata: { sourceYear, sourceMonth },
  });

  return NextResponse.json(
    { id: competenciaId(year, month), name: `${String(month).padStart(2, "0")}/${year}` },
    { status: 201 },
  );
});
