import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { borderToFormInput } from "@/lib/border-mapper";
import { BorderForm } from "@/components/admin/borders/border-form";
import { DuplicateButton } from "@/components/shared/duplicate-button";
import { CopyXmlButton } from "@/components/shared/copy-xml-button";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Editar border",
};

export default async function EditBorderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const border = await prisma.border.findUnique({ where: { id: Number(id) } });

  if (!border) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/borders" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Editar border: {border.name}</h1>
          <p className="text-muted-foreground">Preencha os dados e acompanhe o XML gerado ao lado.</p>
        </div>
        <div className="flex items-center gap-2">
          <CopyXmlButton endpoint={`/api/admin/borders/${border.id}/export`} />
          <DuplicateButton
            endpoint={`/api/admin/borders/${border.id}/duplicate`}
            editPathBase="/admin/borders"
            variant="header"
          />
        </div>
      </div>
      <BorderForm isEditing initialValues={borderToFormInput(border)} />
    </div>
  );
}
