import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { questInputToPrismaData, questSchema } from "@/lib/validations/admin/quest";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const PATCH = withAudit(async function PATCH(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const body = await request.json();
  const parsed = questSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const category = await prisma.category.findUnique({ where: { id: parsed.data.categoryId } });
  if (!category) {
    return NextResponse.json({ error: "Categoria não encontrada." }, { status: 422 });
  }

  const entry = await prisma.quest.update({
    where: { id: Number(id) },
    data: questInputToPrismaData(parsed.data, category.name),
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "quest",
    entityId: entry.id,
    metadata: { name: entry.name },
  });

  return NextResponse.json({ entry });
});

export const DELETE = withAudit(async function DELETE(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  await prisma.quest.delete({ where: { id: Number(id) } });

  await logAudit({
    accountId: Number(session.user.id),
    action: "delete",
    entity: "quest",
    entityId: id,
  });

  return NextResponse.json({ success: true });
});
