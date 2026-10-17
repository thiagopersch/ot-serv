"use client";

import { toast } from "sonner";

import type { QuestInput } from "@/lib/validations/admin/quest";
import { QuestForm } from "@/components/admin/quests/quest-form";

export function EditQuestForm({
  questId,
  imageUrl,
  initialValues,
}: {
  questId: number;
  imageUrl: string | null;
  initialValues: QuestInput;
}) {
  async function handleSubmit(values: QuestInput): Promise<boolean> {
    const response = await fetch(`/api/admin/quests/${questId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (response.ok) return true;
    const data = await response.json().catch(() => null);
    if (data?.error) toast.error(data.error);
    return false;
  }

  return (
    <QuestForm
      questId={questId}
      imageUrl={imageUrl}
      defaultValues={initialValues}
      onSubmit={handleSubmit}
      successMessage="Atualizada com sucesso."
    />
  );
}
