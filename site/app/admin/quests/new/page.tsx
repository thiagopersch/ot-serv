"use client";

import { toast } from "sonner";

import { defaultQuestValues, type QuestInput } from "@/lib/validations/admin/quest";
import { QuestForm } from "@/components/admin/quests/quest-form";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export default function NewQuestPage() {
  async function handleSubmit(values: QuestInput): Promise<boolean> {
    const response = await fetch("/api/admin/quests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (response.ok) return true;
    const data = await response.json().catch(() => null);
    if (data?.error) toast.error(data.error);
    return false;
  }

  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/quests" />
      <div>
        <h1 className="text-2xl font-semibold">Nova quest</h1>
        <p className="text-muted-foreground">
          A lógica de conclusão continua em scripts do servidor (via `QuestLib.completeQuest`) —
          este cadastro define nome, descrição, requisitos e recompensas.
        </p>
      </div>
      <QuestForm defaultValues={defaultQuestValues} onSubmit={handleSubmit} successMessage="Criada com sucesso." />
    </div>
  );
}
