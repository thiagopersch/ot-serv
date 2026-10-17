import type { Metadata } from "next";

import { GroundForm } from "@/components/admin/grounds/ground-form";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Novo ground",
};

export default function NewGroundPage() {
  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/grounds" />
      <div>
        <h1 className="text-2xl font-semibold">Novo ground</h1>
        <p className="text-muted-foreground">Preencha os dados e acompanhe o XML gerado ao lado.</p>
      </div>
      <GroundForm />
    </div>
  );
}
