import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { defaultOutfitValues } from "@/lib/validations/admin/outfit";
import { OutfitForm } from "@/components/admin/outfits/outfit-form";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Nova outfit",
};

export const dynamic = "force-dynamic";

export default async function NewOutfitPage() {
  const last = await prisma.outfitDefinition.findFirst({ orderBy: { id: "desc" }, select: { id: true } });

  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/outfits" />
      <div>
        <h1 className="text-2xl font-semibold">Nova outfit</h1>
        <p className="text-muted-foreground">Preencha os dados e acompanhe o XML gerado ao lado.</p>
      </div>
      <OutfitForm initialValues={{ ...defaultOutfitValues, id: (last?.id ?? 0) + 1 }} />
    </div>
  );
}
