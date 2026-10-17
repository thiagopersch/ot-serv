import type { Metadata } from "next";

import { ItemForm } from "@/components/admin/items/item-form";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Novo item",
};

export default function NewItemPage() {
  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/items" />
      <div>
        <h1 className="text-2xl font-semibold">Novo item</h1>
        <p className="text-muted-foreground">Preencha os dados e acompanhe o XML gerado ao lado.</p>
      </div>
      <ItemForm />
    </div>
  );
}
