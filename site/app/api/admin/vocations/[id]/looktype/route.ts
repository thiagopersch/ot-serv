import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { withAudit } from "@/lib/api-audit-wrapper";

const looktypeLinkSchema = z.object({ lookTypeId: z.number().int().nullable() });

export const PATCH = withAudit(async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const body = await request.json();
  const parsed = looktypeLinkSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const vocation = await prisma.vocation.update({
    where: { id: Number(id) },
    data: { lookTypeId: parsed.data.lookTypeId },
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "vocation",
    entityId: vocation.id,
    metadata: { lookTypeId: vocation.lookTypeId },
  });

  return NextResponse.json({ lookTypeId: vocation.lookTypeId });
});
