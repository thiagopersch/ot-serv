import type { Metadata } from "next";

import { BorderForm } from "@/components/admin/borders/border-form";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Novo border",
};

export default function NewBorderPage() {
  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/borders" />
      <div>
        <h1 className="text-2xl font-semibold">Novo border</h1>
        <p className="text-muted-foreground">Preencha os dados e acompanhe o XML gerado ao lado.</p>
      </div>
      <BorderForm />
    </div>
  );
}
