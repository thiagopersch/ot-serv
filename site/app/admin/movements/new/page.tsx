import type { Metadata } from "next";

import { defaultMovementValues } from "@/lib/validations/admin/movement";
import { MovementForm } from "@/components/admin/movements/movement-form";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Novo movement",
};

export default async function NewMovementPage({
  searchParams,
}: {
  searchParams: Promise<{ itemId?: string }>;
}) {
  const { itemId } = await searchParams;
  const initialValues =
    itemId && Number.isFinite(Number(itemId))
      ? { ...defaultMovementValues, selectorType: "ITEM_ID" as const, itemId: Number(itemId) }
      : undefined;

  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/movements" />
      <div>
        <h1 className="text-2xl font-semibold">Novo movement</h1>
        <p className="text-muted-foreground">Preencha os dados e acompanhe o XML gerado ao lado.</p>
      </div>
      <MovementForm initialValues={initialValues} />
    </div>
  );
}
