import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { monsterRowToFormInput } from "@/lib/monster-mapper";
import { MonsterForm } from "@/components/admin/monsters/monster-form";
import { DuplicateButton } from "@/components/shared/duplicate-button";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Editar monstro",
};

export default async function EditMonsterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const monster = await prisma.monster.findUnique({
    where: { id: Number(id) },
    include: { spells: { select: { spellId: true } } },
  });

  if (!monster) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/monsters" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Editar monstro: {monster.name}</h1>
          <p className="text-muted-foreground">Preencha os dados e acompanhe o XML gerado ao lado.</p>
        </div>
        <DuplicateButton
          endpoint={`/api/admin/monsters/${monster.id}/duplicate`}
          editPathBase="/admin/monsters"
          variant="header"
        />
      </div>
      <MonsterForm monsterId={monster.id} initialValues={monsterRowToFormInput(monster)} />
    </div>
  );
}
