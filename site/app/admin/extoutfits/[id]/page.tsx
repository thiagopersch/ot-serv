import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { extOutfitInclude, extOutfitToRow } from "@/lib/extoutfit-mapper";
import { ExtOutfitForm } from "@/components/admin/extoutfits/extoutfit-form";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Editar extoutfit",
};

export default async function EditExtOutfitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = await prisma.extOutfit.findUnique({ where: { id: Number(id) }, include: extOutfitInclude });

  if (!entry) {
    notFound();
  }

  const row = extOutfitToRow(entry);

  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/extoutfits" />
      <div>
        <h1 className="text-2xl font-semibold">
          Editar {row.kind}: {row.name}
        </h1>
        <p className="text-muted-foreground">Preencha os dados e acompanhe o XML gerado ao lado.</p>
      </div>
      <ExtOutfitForm
        extOutfitId={row.id}
        initialValues={{
          kind: row.kind,
          xmlId: row.xmlId,
          name: row.name,
          looktypeId: row.looktypeId,
          shaderName: row.shaderName ?? "",
          image: row.image ?? "",
          posx: row.posx,
          posy: row.posy,
        }}
        initialLooktypeNumber={row.looktypeNumber}
        shaderTex1Url={row.shaderTex1Url}
      />
    </div>
  );
}
