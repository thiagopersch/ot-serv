import type { Metadata } from "next";

import { VocationForm } from "@/components/admin/vocations/vocation-form";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Nova vocação",
};

export default function NewVocationPage() {
  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/vocations" />
      <div>
        <h1 className="text-2xl font-semibold">Nova vocação</h1>
        <p className="text-muted-foreground">Preencha os dados e acompanhe o XML gerado ao lado.</p>
      </div>
      <VocationForm />
    </div>
  );
}
