import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { movementSchema } from "@/lib/validations/admin/movement";
import { movementFormToRow, movementRowToFormInput } from "@/lib/movement-mapper";
import { withAudit } from "@/lib/api-audit-wrapper";

const MOVEMENT_INCLUDE = { vocations: { select: { vocationId: true } } } as const;

type Params = { params: Promise<{ id: string }> };

export const GET = withAudit(async function GET(_request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const movement = await prisma.movement.findUnique({
    where: { id: Number(id) },
    include: MOVEMENT_INCLUDE,
  });

  if (!movement) {
    return NextResponse.json({ error: "Movement não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ movement: movementRowToFormInput(movement) });
});

export const PATCH = withAudit(async function PATCH(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const body = await request.json();
  const parsed = movementSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 422 }
    );
  }

  const movement = await prisma.movement.update({
    where: { id: Number(id) },
    data: {
      ...movementFormToRow(parsed.data),
      vocations: {
        deleteMany: {},
        create: parsed.data.vocations.map((v) => ({ vocationId: v.vocationId })),
      },
    },
    include: MOVEMENT_INCLUDE,
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "movement",
    entityId: movement.id,
    metadata: { eventType: movement.eventType },
  });

  return NextResponse.json({ movement: movementRowToFormInput(movement) });
});

export const DELETE = withAudit(async function DELETE(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  await prisma.movement.delete({ where: { id: Number(id) } });

  await logAudit({
    accountId: Number(session.user.id),
    action: "delete",
    entity: "movement",
    entityId: id,
  });

  return NextResponse.json({ success: true });
});
