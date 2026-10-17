import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { vocationToInput } from "@/lib/vocation-mapper";
import { VocationForm } from "@/components/admin/vocations/vocation-form";
import { DuplicateButton } from "@/components/shared/duplicate-button";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Editar vocação",
};

export default async function EditVocationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vocation = await prisma.vocation.findUnique({ where: { id: Number(id) } });

  if (!vocation) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/vocations" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Editar vocação: {vocation.name}</h1>
          <p className="text-muted-foreground">Preencha os dados e acompanhe o XML gerado ao lado.</p>
        </div>
        <DuplicateButton
          endpoint={`/api/admin/vocations/${vocation.id}/duplicate`}
          editPathBase="/admin/vocations"
          variant="header"
        />
      </div>
      <VocationForm vocationId={vocation.id} initialValues={vocationToInput(vocation)} />
    </div>
  );
}
