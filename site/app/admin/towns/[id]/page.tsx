import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { townToFormInput } from "@/lib/town-mapper";
import { TownForm } from "@/components/admin/towns/town-form";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Editar town",
};

export default async function EditTownPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const town = await prisma.town.findUnique({ where: { id: Number(id) } });

  if (!town) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/towns" />
      <div>
        <h1 className="text-2xl font-semibold">Editar town: {town.name}</h1>
        <p className="text-muted-foreground">Preencha os dados da cidade/local.</p>
      </div>
      <TownForm isEditing initialValues={townToFormInput(town)} />
    </div>
  );
}
