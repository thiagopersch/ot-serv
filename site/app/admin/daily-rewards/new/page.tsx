import type { Metadata } from "next";

import { DailyRewardCompetenciaForm } from "@/components/admin/daily-rewards/daily-reward-competencia-form";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Nova competência de recompensas diárias",
};

export default function NewDailyRewardCompetenciaPage() {
  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/daily-rewards" />
      <div>
        <h1 className="text-2xl font-semibold">Nova competência</h1>
        <p className="text-muted-foreground">
          Configure o mês/ano e as recompensas diárias/bonus.
        </p>
      </div>
      <DailyRewardCompetenciaForm />
    </div>
  );
}
