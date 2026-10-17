import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { itemRowToFormInput } from "@/lib/item-mapper";
import { ItemForm } from "@/components/admin/items/item-form";
import { DuplicateButton } from "@/components/shared/duplicate-button";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Editar item",
};

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await prisma.item.findUnique({ where: { id: Number(id) } });

  if (!item) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/items" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            Editar item: {item.name} (#{item.id})
          </h1>
          <p className="text-muted-foreground">Preencha os dados e acompanhe o XML gerado ao lado.</p>
        </div>
        <DuplicateButton
          endpoint={`/api/admin/items/${item.id}/duplicate`}
          editPathBase="/admin/items"
          variant="header"
        />
      </div>
      <ItemForm itemId={item.id} initialValues={itemRowToFormInput(item)} />
    </div>
  );
}
