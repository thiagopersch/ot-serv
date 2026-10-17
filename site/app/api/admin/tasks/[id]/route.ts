import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import {
  taskDefinitionSchema,
  taskDefinitionInputToRow,
  normalizeTaskCategory,
  isValidTaskUniverse,
  TASK_VALID_UNIVERSES,
} from "@/lib/validations/admin/task-definition";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const PATCH = withAudit(async function PATCH(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const body = await request.json();
  const parsed = taskDefinitionSchema.safeParse({ ...body, id });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 422 },
    );
  }

  const category = await prisma.category.findUnique({ where: { id: parsed.data.categoryId } });
  if (!category) {
    return NextResponse.json({ error: "Categoria não encontrada." }, { status: 422 });
  }

  if (!isValidTaskUniverse(normalizeTaskCategory(category.name))) {
    return NextResponse.json(
      {
        error: `A Categoria "${category.name}" não corresponde a nenhum universo do jogo (${TASK_VALID_UNIVERSES.join(", ")}). A task ficaria salva mas invisível no módulo de tasks do cliente. Renomeie a Categoria para um desses nomes (sem acentos/espaços) ou escolha outra.`,
      },
      { status: 422 },
    );
  }

  const { id: _ignoredId, ...data } = taskDefinitionInputToRow(parsed.data, category.name);
  void _ignoredId;

  const entry = await prisma.taskDefinition.update({ where: { id }, data });

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "task_definition",
    entityId: entry.id,
    metadata: { name: entry.name },
  });

  return NextResponse.json({ entry });
});

export const DELETE = withAudit(async function DELETE(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  await prisma.taskDefinition.delete({ where: { id } });

  await logAudit({
    accountId: Number(session.user.id),
    action: "delete",
    entity: "task_definition",
    entityId: id,
  });

  return NextResponse.json({ success: true });
});
