import type { Metadata } from "next";

import { loadDailyRewardDefault } from "@/lib/daily-reward-generator";
import { DailyRewardDefaultForm } from "@/components/admin/daily-rewards/daily-reward-default-form";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Padrão de recompensas diárias",
};

export const dynamic = "force-dynamic";

export default async function DailyRewardDefaultPage() {
  const initialValues = await loadDailyRewardDefault();

  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/daily-rewards" />
      <div>
        <h1 className="text-2xl font-semibold">Padrão do mês</h1>
        <p className="text-muted-foreground">
          Itens usados para gerar automaticamente as recompensas de cada mês. Na virada do mês, se
          a competência ainda não foi cadastrada, o servidor sorteia as recompensas diárias e bonus
          a partir deste padrão (dias faltantes de uma competência incompleta também são
          completados).
        </p>
      </div>
      <DailyRewardDefaultForm initialValues={initialValues} />
    </div>
  );
}
