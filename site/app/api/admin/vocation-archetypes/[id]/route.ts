import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { vocationTypeSchema } from "@/lib/validations/admin/vocation";
import { hasDuplicateName } from "@/lib/unique-name";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const PATCH = withAudit(async function PATCH(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const body = await request.json();
  const parsed = vocationTypeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const existingNames = await prisma.vocationArchetype.findMany({ select: { id: true, name: true } });
  if (hasDuplicateName(existingNames, parsed.data.name, Number(id))) {
    return NextResponse.json({ error: "Já existe um arquétipo com esse nome." }, { status: 409 });
  }

  const vocationArchetype = await prisma.vocationArchetype.update({
    where: { id: Number(id) },
    data: parsed.data,
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "vocation_archetype",
    entityId: vocationArchetype.id,
    metadata: parsed.data,
  });

  return NextResponse.json({ archetype: vocationArchetype });
});

export const DELETE = withAudit(async function DELETE(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  await prisma.vocationArchetype.delete({ where: { id: Number(id) } });

  await logAudit({
    accountId: Number(session.user.id),
    action: "delete",
    entity: "vocation_archetype",
    entityId: id,
  });

  return NextResponse.json({ success: true });
});
