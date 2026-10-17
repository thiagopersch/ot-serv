import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { withAudit } from "@/lib/api-audit-wrapper";
import { competenciaId } from "@/lib/daily-reward-competencia";
import {
  generateCompetenciaFromDefault,
  loadDailyRewardDefault,
} from "@/lib/daily-reward-generator";

const generateSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  /** true = só devolve as recompensas sorteadas (preencher o formulário), sem salvar. */
  dryRun: z.boolean().optional(),
});

/** Gera uma competência a partir do padrão (`/admin/daily-rewards/default`) — o mesmo que o
 * servidor faz sozinho na virada do mês quando ninguém configurou o mês antes. */
export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const parsed = generateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }
  const { month, year, dryRun } = parsed.data;

  const { rewards, bonusRewards } = generateCompetenciaFromDefault(
    await loadDailyRewardDefault(),
    year,
    month,
  );
  if (rewards.length === 0) {
    return NextResponse.json(
      { error: "O padrão não tem itens diários — configure em Padrão do mês." },
      { status: 422 },
    );
  }

  if (dryRun) {
    return NextResponse.json({ year, month, rewards, bonusRewards });
  }

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
    action: "generate",
    entity: "daily_rewards_competencia",
    entityId: competenciaId(year, month),
    metadata: { rewardCount: rewards.length, bonusCount: bonusRewards.length },
  });

  return NextResponse.json({ id: competenciaId(year, month), year, month }, { status: 201 });
});
