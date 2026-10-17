import type { Metadata } from "next";

import { DoodadForm } from "@/components/admin/doodads/doodad-form";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Novo doodad",
};

export default function NewDoodadPage() {
  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/doodads" />
      <div>
        <h1 className="text-2xl font-semibold">Novo doodad</h1>
        <p className="text-muted-foreground">Preencha os dados e acompanhe o XML gerado ao lado.</p>
      </div>
      <DoodadForm />
    </div>
  );
}
