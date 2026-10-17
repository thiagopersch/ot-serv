import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { outfitInclude, outfitToRow } from "@/lib/outfit-mapper";
import { OutfitForm } from "@/components/admin/outfits/outfit-form";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Editar outfit",
};

export default async function EditOutfitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const outfit = await prisma.outfitDefinition.findUnique({ where: { id: Number(id) }, include: outfitInclude });

  if (!outfit) {
    notFound();
  }

  const row = outfitToRow(outfit);

  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/outfits" />
      <div>
        <h1 className="text-2xl font-semibold">Editar outfit: {outfit.name}</h1>
        <p className="text-muted-foreground">Preencha os dados e acompanhe o XML gerado ao lado.</p>
      </div>
      <OutfitForm
        outfitId={outfit.id}
        initialValues={{
          id: row.id,
          name: row.name,
          type: row.type,
          premium: row.premium,
          storageId: row.storageId ?? "",
          storageValue: row.storageValue ?? "",
          maleLooktypeId: row.maleLooktypeId,
          femaleLooktypeId: row.femaleLooktypeId,
          unlockItemId: row.unlockItemId,
        }}
        initialLooktypeNumbers={{ male: row.maleLooktypeNumber, female: row.femaleLooktypeNumber }}
        extraAttributes={row.extraAttributes}
      />
    </div>
  );
}
