import type { Metadata } from "next";

import { TownForm } from "@/components/admin/towns/town-form";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Nova town",
};

export default function NewTownPage() {
  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/towns" />
      <div>
        <h1 className="text-2xl font-semibold">Nova town</h1>
        <p className="text-muted-foreground">Preencha os dados da cidade/local.</p>
      </div>
      <TownForm />
    </div>
  );
}
