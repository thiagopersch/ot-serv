import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { doodadBrushToFormInput } from "@/lib/doodad-mapper";
import { DoodadForm } from "@/components/admin/doodads/doodad-form";
import { DuplicateButton } from "@/components/shared/duplicate-button";
import { CopyXmlButton } from "@/components/shared/copy-xml-button";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Editar doodad",
};

export default async function EditDoodadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const brush = await prisma.doodadBrush.findUnique({ where: { id: Number(id) } });

  if (!brush) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/doodads" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Editar doodad: {brush.name}</h1>
          <p className="text-muted-foreground">Preencha os dados e acompanhe o XML gerado ao lado.</p>
        </div>
        <div className="flex items-center gap-2">
          <CopyXmlButton endpoint={`/api/admin/doodads/${brush.id}/export`} />
          <DuplicateButton
            endpoint={`/api/admin/doodads/${brush.id}/duplicate`}
            editPathBase="/admin/doodads"
            variant="header"
          />
        </div>
      </div>
      <DoodadForm brushId={brush.id} initialValues={doodadBrushToFormInput(brush)} />
    </div>
  );
}
