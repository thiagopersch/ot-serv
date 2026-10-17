import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { tilesetItemEntryFormSchema } from "@/lib/validations/admin/tileset";
import { tilesetItemEntryToFormInput } from "@/lib/tileset-mapper";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ entryId: string }> };

export const PATCH = withAudit(async function PATCH(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { entryId } = await params;
  const body = await request.json();
  const parsed = tilesetItemEntryFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const entry = await prisma.tilesetItemEntry.update({
    where: { id: Number(entryId) },
    data: {
      order: parsed.data.order,
      kind: parsed.data.kind,
      itemId: parsed.data.itemId,
      fromId: parsed.data.fromId,
      toId: parsed.data.toId,
    },
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "tileset_item_entry",
    entityId: entry.id,
  });

  return NextResponse.json({ entry: tilesetItemEntryToFormInput(entry) });
});

export const DELETE = withAudit(async function DELETE(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { entryId } = await params;
  await prisma.tilesetItemEntry.delete({ where: { id: Number(entryId) } });

  await logAudit({
    accountId: Number(session.user.id),
    action: "delete",
    entity: "tileset_item_entry",
    entityId: entryId,
  });

  return NextResponse.json({ success: true });
});
