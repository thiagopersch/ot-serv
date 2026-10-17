import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { nextManualId } from "@/lib/duplicate-utils";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const POST = withAudit(async function POST(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const source = await prisma.vocation.findUnique({ where: { id: Number(id) } });

  if (!source) {
    return NextResponse.json({ error: "Vocação não encontrada." }, { status: 404 });
  }

  const { id: _id, name, createdAt, updatedAt, ...rest } = source;
  void _id;
  void createdAt;
  void updatedAt;

  const newId = await nextManualId(() =>
    prisma.vocation.aggregate({ _max: { id: true } }).then((result) => result._max.id),
  );

  const vocation = await prisma.vocation.create({
    data: { ...rest, id: newId, name: `${name} (cópia)` },
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "duplicate",
    entity: "vocation",
    entityId: vocation.id,
    metadata: { sourceId: source.id, name: vocation.name },
  });

  return NextResponse.json({ id: vocation.id, name: vocation.name }, { status: 201 });
});
