import type { Metadata } from "next";

import { ExtOutfitForm } from "@/components/admin/extoutfits/extoutfit-form";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Novo extoutfit",
};

export default function NewExtOutfitPage() {
  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/extoutfits" />
      <div>
        <h1 className="text-2xl font-semibold">Novo registro do extoutfits.xml</h1>
        <p className="text-muted-foreground">Preencha os dados e acompanhe o XML gerado ao lado.</p>
      </div>
      <ExtOutfitForm />
    </div>
  );
}
