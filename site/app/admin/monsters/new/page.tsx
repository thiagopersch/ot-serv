import type { Metadata } from "next";

import { MonsterForm } from "@/components/admin/monsters/monster-form";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Novo monstro",
};

export default function NewMonsterPage() {
  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/monsters" />
      <div>
        <h1 className="text-2xl font-semibold">Novo monstro</h1>
        <p className="text-muted-foreground">Preencha os dados e acompanhe o XML gerado ao lado.</p>
      </div>
      <MonsterForm />
    </div>
  );
}
