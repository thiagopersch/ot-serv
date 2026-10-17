import type { Metadata } from "next";

import { BattlePassSeasonForm } from "@/components/admin/battle-pass/battle-pass-season-form";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Nova temporada de Battle Pass",
};

export default function NewBattlePassSeasonPage() {
  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/battle-pass" />
      <div>
        <h1 className="text-2xl font-semibold">Nova temporada</h1>
        <p className="text-muted-foreground">
          Configure o mês/ano, as missões e as recompensas do Battle Pass.
        </p>
      </div>
      <BattlePassSeasonForm />
    </div>
  );
}
