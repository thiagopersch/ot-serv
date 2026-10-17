import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { npcCategorySchema } from "@/lib/validations/admin/npc-category";
import { hasDuplicateName } from "@/lib/unique-name";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const PATCH = withAudit(async function PATCH(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const categoryId = Number(id);
  const body = await request.json();
  const parsed = npcCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const existingNames = await prisma.npcCategory.findMany({ select: { id: true, name: true } });
  if (hasDuplicateName(existingNames, parsed.data.name, categoryId)) {
    return NextResponse.json({ error: "Já existe uma categoria com esse nome." }, { status: 409 });
  }

  const category = await prisma.npcCategory.update({
    where: { id: categoryId },
    data: { ...parsed.data, description: parsed.data.description || null },
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "npc_category",
    entityId: category.id,
    metadata: { name: category.name },
  });

  return NextResponse.json({ category });
});

export const DELETE = withAudit(async function DELETE(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  await prisma.npcCategory.delete({ where: { id: Number(id) } });

  await logAudit({
    accountId: Number(session.user.id),
    action: "delete",
    entity: "npc_category",
    entityId: id,
  });

  return NextResponse.json({ success: true });
});
