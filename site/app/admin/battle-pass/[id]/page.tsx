import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import type { BattlePassSeasonInput } from "@/lib/validations/admin/battle-pass";
import { BattlePassSeasonForm } from "@/components/admin/battle-pass/battle-pass-season-form";
import { DuplicateButton } from "@/components/shared/duplicate-button";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Editar temporada de Battle Pass",
};

export default async function EditBattlePassSeasonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const season = await prisma.battlePassSeason.findUnique({
    where: { id: Number(id) },
    include: {
      missions: { orderBy: { id: "asc" } },
      rewards: { orderBy: [{ track: "asc" }, { level: "asc" }, { order: "asc" }] },
    },
  });

  if (!season) {
    notFound();
  }

  const initialValues: BattlePassSeasonInput = {
    month: season.month,
    year: season.year,
    maxLevel: season.maxLevel,
    xpPerLevel: season.xpPerLevel,
    goldPassItemId: season.goldPassItemId,
    goldPassCost: season.goldPassCost,
    levelPurchaseItemId: season.levelPurchaseItemId,
    levelPurchaseCost: season.levelPurchaseCost,
    missions: season.missions.map((mission) => ({
      type: mission.type as BattlePassSeasonInput["missions"][number]["type"],
      target: mission.target as BattlePassSeasonInput["missions"][number]["target"],
      description: mission.description,
      xpReward: mission.xpReward,
      published: mission.published,
    })),
    rewards: season.rewards.map((reward) => ({
      level: reward.level,
      track: reward.track as BattlePassSeasonInput["rewards"][number]["track"],
      rarity: reward.rarity as BattlePassSeasonInput["rewards"][number]["rarity"],
      itemId: reward.itemId,
      count: reward.count,
      order: reward.order,
    })),
  };

  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/battle-pass" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            Editar temporada {String(season.month).padStart(2, "0")}/{season.year}
          </h1>
          <p className="text-muted-foreground">
            Configure o mês/ano, as missões e as recompensas do Battle Pass.
          </p>
        </div>
        <DuplicateButton
          endpoint={`/api/admin/battle-pass/seasons/${season.id}/duplicate`}
          editPathBase="/admin/battle-pass"
          variant="header"
        />
      </div>
      <BattlePassSeasonForm seasonId={season.id} initialValues={initialValues} />
    </div>
  );
}
