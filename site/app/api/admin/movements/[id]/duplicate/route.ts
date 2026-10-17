import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import type { Prisma } from "@/lib/generated/prisma/client";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const POST = withAudit(async function POST(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const source = await prisma.movement.findUnique({ where: { id: Number(id) } });

  if (!source) {
    return NextResponse.json({ error: "Movement não encontrado." }, { status: 404 });
  }

  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = source;
  void _id;
  void _createdAt;
  void _updatedAt;

  const movement = await prisma.movement.create({
    data: { ...rest } as Prisma.MovementUncheckedCreateInput,
  });

  const name = `Movimento #${movement.id} (cópia)`;

  await logAudit({
    accountId: Number(session.user.id),
    action: "duplicate",
    entity: "movement",
    entityId: movement.id,
    metadata: { sourceId: source.id, name },
  });

  return NextResponse.json({ id: movement.id, name }, { status: 201 });
});
