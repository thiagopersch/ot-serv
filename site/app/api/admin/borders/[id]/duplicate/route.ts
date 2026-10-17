import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { nextManualId } from "@/lib/duplicate-utils";
import type { Prisma } from "@/lib/generated/prisma/client";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const POST = withAudit(async function POST(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const source = await prisma.border.findUnique({ where: { id: Number(id) } });

  if (!source) {
    return NextResponse.json({ error: "Border não encontrado." }, { status: 404 });
  }

  const { id: _id, name, createdAt, updatedAt, ...rest } = source;
  void _id;
  void createdAt;
  void updatedAt;

  const newId = await nextManualId(() =>
    prisma.border.aggregate({ _max: { id: true } }).then((result) => result._max.id),
  );

  const border = await prisma.border.create({
    data: { ...rest, id: newId, name: `${name} (cópia)` } as Prisma.BorderUncheckedCreateInput,
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "duplicate",
    entity: "border",
    entityId: border.id,
    metadata: { sourceId: source.id, name: border.name },
  });

  return NextResponse.json({ id: border.id, name: border.name }, { status: 201 });
});
