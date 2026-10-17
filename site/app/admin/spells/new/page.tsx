import type { Metadata } from "next";

import { SpellForm } from "@/components/admin/spells/spell-form";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Nova spell",
};

export default function NewSpellPage() {
  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/spells" />
      <div>
        <h1 className="text-2xl font-semibold">Nova spell</h1>
        <p className="text-muted-foreground">Preencha os dados e acompanhe o XML gerado ao lado.</p>
      </div>
      <SpellForm />
    </div>
  );
}
