import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { TilesetDetail } from "@/components/admin/tilesets/tileset-detail";
import { DuplicateButton } from "@/components/shared/duplicate-button";
import { CopyXmlButton } from "@/components/shared/copy-xml-button";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Editar tileset",
};

export default async function EditTilesetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tileset = await prisma.tileset.findUnique({ where: { id: Number(id) }, select: { id: true, name: true } });

  if (!tileset) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/tilesets" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{tileset.name}</h1>
          <p className="text-muted-foreground">
            Gerencie as categorias deste tileset e os brushes/itens vinculados a cada uma.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CopyXmlButton endpoint={`/api/admin/tilesets/export?ids=${tileset.id}`} />
          <DuplicateButton
            endpoint={`/api/admin/tilesets/${tileset.id}/duplicate`}
            editPathBase="/admin/tilesets"
            variant="header"
          />
        </div>
      </div>
      <TilesetDetail tilesetId={tileset.id} />
    </div>
  );
}
