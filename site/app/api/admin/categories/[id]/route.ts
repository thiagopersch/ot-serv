import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { categorySchema } from "@/lib/validations/admin/category";
import { hasDuplicateName } from "@/lib/unique-name";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const PATCH = withAudit(async function PATCH(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const categoryId = Number(id);
  const body = await request.json();
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const existingNames = await prisma.category.findMany({ select: { id: true, name: true } });
  if (hasDuplicateName(existingNames, parsed.data.name, categoryId)) {
    return NextResponse.json({ error: "Já existe uma categoria com esse nome." }, { status: 409 });
  }

  // Renomear a categoria precisa refletir no `category` (string denormalizada, é o que os
  // scripts Lua/engine leem) de toda quest/task já vinculada — nunca deixa dessincronizado.
  const [category] = await prisma.$transaction([
    prisma.category.update({ where: { id: categoryId }, data: parsed.data }),
    prisma.quest.updateMany({ where: { categoryId }, data: { category: parsed.data.name } }),
    prisma.taskDefinition.updateMany({ where: { categoryId }, data: { category: parsed.data.name } }),
  ]);

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "category",
    entityId: category.id,
    metadata: { name: category.name },
  });

  return NextResponse.json({ category });
});

export const DELETE = withAudit(async function DELETE(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  await prisma.category.delete({ where: { id: Number(id) } });

  await logAudit({
    accountId: Number(session.user.id),
    action: "delete",
    entity: "category",
    entityId: id,
  });

  return NextResponse.json({ success: true });
});
