"use client";

import { toast } from "sonner";

import { defaultTaskDefinitionValues, type TaskDefinitionInput } from "@/lib/validations/admin/task-definition";
import { TaskDefinitionForm } from "@/components/admin/tasks/task-definition-form";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export default function NewTaskDefinitionPage() {
  async function handleSubmit(values: TaskDefinitionInput): Promise<boolean | "conflict"> {
    const response = await fetch("/api/admin/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (response.ok) return true;
    if (response.status === 409) return "conflict";
    const data = await response.json().catch(() => null);
    if (data?.error) toast.error(data.error);
    return false;
  }

  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/tasks" />
      <div>
        <h1 className="text-2xl font-semibold">Nova task</h1>
        <p className="text-muted-foreground">
          Ao publicar, a task passa a ser carregada pelo servidor (tabela `task_definitions`)
          sem precisar reiniciar.
        </p>
      </div>
      <TaskDefinitionForm
        defaultValues={defaultTaskDefinitionValues}
        onSubmit={handleSubmit}
        successMessage="Criada com sucesso."
      />
    </div>
  );
}
