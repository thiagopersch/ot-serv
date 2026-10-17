import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { withAudit } from "@/lib/api-audit-wrapper";

const publishSchema = z.object({ published: z.boolean() });

export const PATCH = withAudit(async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const body = await request.json();
  const parsed = publishSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const vocation = await prisma.vocation.update({
    where: { id: Number(id) },
    data: { publishedGameplay: parsed.data.published },
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "vocation",
    entityId: vocation.id,
    metadata: { publishedGameplay: vocation.publishedGameplay },
  });

  return NextResponse.json({ published: vocation.publishedGameplay });
});
