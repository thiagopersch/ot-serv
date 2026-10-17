import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { NpcForm } from "@/components/admin/npcs/npc-form";
import { toNpcInput } from "@/lib/validations/admin/npc";
import { reconcileNpcFromDisk } from "@/lib/npc-file-sync";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Editar NPC",
};

export default async function EditNpcPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const found = await prisma.npc.findUnique({ where: { id: Number(id) } });

  if (!found) {
    notFound();
  }

  // Reconcilia com `data/npc/{nome}.xml` antes de exibir — pega edições feitas direto no arquivo
  // (manuais ou pelo Explorador) que ainda não foram refletidas no banco.
  const npc = await reconcileNpcFromDisk(found);
  const initialValues = toNpcInput(npc);

  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/npcs" />
      <div>
        <h1 className="text-2xl font-semibold">
          Editar NPC: {npc.name} (#{npc.id})
        </h1>
        <p className="text-muted-foreground">
          Ao salvar, regrava data/npc/{npc.name}.xml no servidor automaticamente.
        </p>
      </div>
      <NpcForm npcId={npc.id} initialValues={initialValues} />
    </div>
  );
}
