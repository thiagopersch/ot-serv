import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { syncActiveSeason } from "@/lib/battle-pass-season";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

/** Acha o próximo mês/ano livre a partir do mês seguinte ao da temporada de origem — evita
 * colidir com o `@@unique([month, year])`. */
async function nextFreeMonthYear(month: number, year: number) {
  let nextMonth = month;
  let nextYear = year;

  for (let i = 0; i < 24; i++) {
    nextMonth += 1;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    const exists = await prisma.battlePassSeason.findUnique({
      where: { month_year: { month: nextMonth, year: nextYear } },
    });
    if (!exists) return { month: nextMonth, year: nextYear };
  }

  throw new Error("Não foi possível encontrar um mês/ano livre para duplicar.");
}

export const POST = withAudit(async function POST(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const source = await prisma.battlePassSeason.findUnique({
    where: { id: Number(id) },
    include: { missions: true, rewards: true },
  });

  if (!source) {
    return NextResponse.json({ error: "Temporada não encontrada." }, { status: 404 });
  }

  const { month, year } = await nextFreeMonthYear(source.month, source.year);

  const season = await prisma.battlePassSeason.create({
    data: {
      month,
      year,
      maxLevel: source.maxLevel,
      xpPerLevel: source.xpPerLevel,
      goldPassItemId: source.goldPassItemId,
      goldPassCost: source.goldPassCost,
      levelPurchaseItemId: source.levelPurchaseItemId,
      levelPurchaseCost: source.levelPurchaseCost,
      missions: {
        create: source.missions.map((mission) => ({
          type: mission.type,
          target: mission.target as unknown as Prisma.InputJsonValue,
          description: mission.description,
          xpReward: mission.xpReward,
          published: mission.published,
        })),
      },
      rewards: {
        create: source.rewards.map((reward) => ({
          level: reward.level,
          track: reward.track,
          rarity: reward.rarity,
          itemId: reward.itemId,
          count: reward.count,
          order: reward.order,
        })),
      },
    },
  });

  await syncActiveSeason();

  await logAudit({
    accountId: Number(session.user.id),
    action: "duplicate",
    entity: "battle_pass_season",
    entityId: season.id,
    metadata: { sourceId: source.id, month, year },
  });

  return NextResponse.json(
    { id: season.id, name: `${String(month).padStart(2, "0")}/${year}` },
    { status: 201 },
  );
});
