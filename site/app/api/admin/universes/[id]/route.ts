import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { universeSchema } from "@/lib/validations/admin/universe";
import { hasDuplicateName } from "@/lib/unique-name";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const PATCH = withAudit(async function PATCH(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const body = await request.json();
  const parsed = universeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const existingNames = await prisma.universe.findMany({ select: { id: true, name: true } });
  if (hasDuplicateName(existingNames, parsed.data.name, Number(id))) {
    return NextResponse.json({ error: "Já existe um universo com esse nome." }, { status: 409 });
  }

  const universe = await prisma.universe.update({
    where: { id: Number(id) },
    data: parsed.data,
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "universe",
    entityId: universe.id,
    metadata: parsed.data,
  });

  return NextResponse.json({ universe });
});

export const DELETE = withAudit(async function DELETE(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  await prisma.universe.delete({ where: { id: Number(id) } });

  await logAudit({
    accountId: Number(session.user.id),
    action: "delete",
    entity: "universe",
    entityId: id,
  });

  return NextResponse.json({ success: true });
});
