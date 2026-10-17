import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { taskDefinitionRowToInput } from "@/lib/validations/admin/task-definition";
import { EditTaskDefinitionForm } from "@/components/admin/tasks/edit-task-definition-form";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Editar task",
};

export default async function EditTaskDefinitionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const task = await prisma.taskDefinition.findUnique({ where: { id } });

  if (!task) {
    notFound();
  }

  const initialValues = taskDefinitionRowToInput(task);

  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/tasks" />
      <div>
        <h1 className="text-2xl font-semibold">Editar task: {task.name}</h1>
        <p className="text-muted-foreground">
          O servidor recarrega a tabela `task_definitions` periodicamente — as mudanças refletem
          no jogo sem precisar reiniciar.
        </p>
      </div>
      <EditTaskDefinitionForm taskId={task.id} initialValues={initialValues} />
    </div>
  );
}
