"use client";

import { toast } from "sonner";

import type { TaskDefinitionInput } from "@/lib/validations/admin/task-definition";
import { TaskDefinitionForm } from "@/components/admin/tasks/task-definition-form";

export function EditTaskDefinitionForm({
  taskId,
  initialValues,
}: {
  taskId: string;
  initialValues: TaskDefinitionInput;
}) {
  async function handleSubmit(values: TaskDefinitionInput): Promise<boolean | "conflict"> {
    const response = await fetch(`/api/admin/tasks/${taskId}`, {
      method: "PATCH",
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
    <TaskDefinitionForm
      defaultValues={initialValues}
      isEditing
      onSubmit={handleSubmit}
      successMessage="Atualizada com sucesso."
    />
  );
}
