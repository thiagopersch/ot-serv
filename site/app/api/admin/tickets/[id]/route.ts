import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { TICKET_STATUSES } from "@/lib/validations/ticket";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

const statusSchema = z.object({ status: z.enum(TICKET_STATUSES) });

export const PATCH = withAudit(async function PATCH(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const body = await request.json();
  const parsed = statusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Status inválido." }, { status: 422 });
  }

  const ticket = await prisma.ticket.update({
    where: { id: Number(id) },
    data: { status: parsed.data.status },
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "update-status",
    entity: "ticket",
    entityId: ticket.id,
    metadata: { status: ticket.status },
  });

  return NextResponse.json({ ticket });
});
