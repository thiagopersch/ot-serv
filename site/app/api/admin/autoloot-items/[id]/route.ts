import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { autolootItemUpdateSchema } from "@/lib/validations/admin/autoloot-item";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const PATCH = withAudit(async function PATCH(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const body = await request.json();
  const parsed = autolootItemUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const autolootItem = await prisma.autolootItem.update({
    where: { id: Number(id) },
    data: parsed.data,
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "autoloot_item",
    entityId: autolootItem.id,
    metadata: parsed.data,
  });

  return NextResponse.json({ autolootItem });
});

export const DELETE = withAudit(async function DELETE(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  await prisma.autolootItem.delete({ where: { id: Number(id) } });

  await logAudit({
    accountId: Number(session.user.id),
    action: "delete",
    entity: "autoloot_item",
    entityId: id,
  });

  return NextResponse.json({ success: true });
});
