import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { parseCompetenciaParam } from "@/lib/daily-reward-competencia";
import type { DailyRewardCompetenciaInput } from "@/lib/validations/admin/daily-reward";
import { DailyRewardCompetenciaForm } from "@/components/admin/daily-rewards/daily-reward-competencia-form";
import { DuplicateButton } from "@/components/shared/duplicate-button";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Editar competência de recompensas diárias",
};

export default async function EditDailyRewardCompetenciaPage({
  params,
}: {
  params: Promise<{ competencia: string }>;
}) {
  const { competencia } = await params;
  const parsed = parseCompetenciaParam(competencia);
  if (!parsed) notFound();
  const { year, month } = parsed;

  const [rewards, bonusRewards] = await Promise.all([
    prisma.dailyRewardsMonthly.findMany({ where: { year, month }, orderBy: { day: "asc" } }),
    prisma.dailyRewardsBonusMonthly.findMany({ where: { year, month }, orderBy: { streakDay: "asc" } }),
  ]);

  if (rewards.length === 0 && bonusRewards.length === 0) {
    notFound();
  }

  const initialValues: DailyRewardCompetenciaInput = {
    year,
    month,
    rewards: rewards.map((r) => ({ day: r.day, itemId: r.itemId, clientId: r.clientId, count: r.count })),
    bonusRewards: bonusRewards.map((r) => ({
      streakDay: r.streakDay,
      itemId: r.itemId,
      clientId: r.clientId,
      count: r.count,
    })),
  };

  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/daily-rewards" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            Editar competência {String(month).padStart(2, "0")}/{year}
          </h1>
          <p className="text-muted-foreground">
            Configure o mês/ano e as recompensas diárias/bonus.
          </p>
        </div>
        <DuplicateButton
          endpoint={`/api/admin/daily-rewards/competencias/${competencia}/duplicate`}
          editPathBase="/admin/daily-rewards"
          variant="header"
        />
      </div>
      <DailyRewardCompetenciaForm competenciaParam={competencia} initialValues={initialValues} />
    </div>
  );
}
