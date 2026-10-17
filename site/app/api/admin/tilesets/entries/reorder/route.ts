import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { withAudit } from "@/lib/api-audit-wrapper";

const reorderSchema = z.object({
  items: z.array(z.object({ id: z.number().int(), order: z.number().int() })).min(1),
});

export const PATCH = withAudit(async function PATCH(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const body = await request.json();
  const parsed = reorderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  await prisma.$transaction(
    parsed.data.items.map(({ id, order }) => prisma.tilesetItemEntry.update({ where: { id }, data: { order } }))
  );

  await logAudit({
    accountId: Number(session.user.id),
    action: "reorder",
    entity: "tileset_item_entry",
    metadata: { count: parsed.data.items.length },
  });

  return NextResponse.json({ success: true });
});
