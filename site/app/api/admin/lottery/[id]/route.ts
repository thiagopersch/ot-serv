import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { lotterySchema } from "@/lib/validations/admin/lottery";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const PATCH = withAudit(async function PATCH(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const body = await request.json();
  const parsed = lotterySchema.partial().safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const entry = await prisma.lottery.update({ where: { id: Number(id) }, data: parsed.data });

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "lottery",
    entityId: entry.id,
    metadata: parsed.data,
  });

  return NextResponse.json({ entry });
});

export const DELETE = withAudit(async function DELETE(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  await prisma.lottery.delete({ where: { id: Number(id) } });

  await logAudit({
    accountId: Number(session.user.id),
    action: "delete",
    entity: "lottery",
    entityId: id,
  });

  return NextResponse.json({ success: true });
});
