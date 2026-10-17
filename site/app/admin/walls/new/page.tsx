import type { Metadata } from "next";

import { WallForm } from "@/components/admin/walls/wall-form";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Nova wall",
};

export default function NewWallPage() {
  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/walls" />
      <div>
        <h1 className="text-2xl font-semibold">Nova wall</h1>
        <p className="text-muted-foreground">Preencha os dados e acompanhe o XML gerado ao lado.</p>
      </div>
      <WallForm />
    </div>
  );
}
