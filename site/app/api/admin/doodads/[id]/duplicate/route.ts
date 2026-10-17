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
  const source = await prisma.doodadBrush.findUnique({ where: { id: Number(id) } });

  if (!source) {
    return NextResponse.json({ error: "Doodad não encontrado." }, { status: 404 });
  }

  const { id: _id, name: _name, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = source;
  void _id;
  void _name;
  void _createdAt;
  void _updatedAt;
  const name = `${source.name} (cópia)`;

  const created = await prisma.doodadBrush.create({
    data: { ...rest, name } as Prisma.DoodadBrushUncheckedCreateInput,
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "duplicate",
    entity: "doodad_brush",
    entityId: created.id,
    metadata: { sourceId: source.id, name: created.name },
  });

  return NextResponse.json({ id: created.id, name: created.name }, { status: 201 });
});
