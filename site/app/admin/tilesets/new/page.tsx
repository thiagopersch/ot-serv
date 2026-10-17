import type { Metadata } from "next";

import { TilesetForm } from "@/components/admin/tilesets/tileset-form";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Novo tileset",
};

export default function NewTilesetPage() {
  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/tilesets" />
      <div>
        <h1 className="text-2xl font-semibold">Novo tileset</h1>
        <p className="text-muted-foreground">
          Depois de criar, você poderá adicionar categorias e vincular brushes na tela de detalhe.
        </p>
      </div>
      <TilesetForm />
    </div>
  );
}
