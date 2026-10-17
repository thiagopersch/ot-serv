import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { spriteTermFor } from "@/lib/validations/admin/looktype";
import { LooktypeEditForm } from "@/components/admin/looktypes/looktype-edit-form";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Editar sprite",
};

export default async function EditLooktypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const looktype = await prisma.looktype.findUnique({ where: { id: Number(id) } });

  if (!looktype) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/looktypes" />
      <div className="mx-auto w-full max-w-xl text-center">
        <h1 className="text-2xl font-semibold">
          Editar {spriteTermFor(looktype.category).toLowerCase()}: {looktype.name} (#{looktype.id})
        </h1>
      </div>
      <LooktypeEditForm looktype={looktype} />
    </div>
  );
}
