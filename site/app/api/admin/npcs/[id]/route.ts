import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { npcSchema } from "@/lib/validations/admin/npc";
import { deleteNpcFiles, writeNpcFiles } from "@/lib/npc-generator";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const PATCH = withAudit(async function PATCH(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const body = await request.json();
  const parsed = npcSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const existing = await prisma.npc.findUnique({ where: { id: Number(id) } });
  if (!existing) {
    return NextResponse.json({ error: "NPC não encontrado." }, { status: 404 });
  }

  const { shopItems, customMessages, defaultMessages, ...npcFields } = parsed.data;

  // Nome mudou: os arquivos antigos ficam órfãos no disco, remove antes de gravar os novos.
  if (existing.name !== npcFields.name) {
    await deleteNpcFiles(existing.name).catch(() => undefined);
  }

  const npc = await prisma.npc.update({
    where: { id: Number(id) },
    data: {
      ...npcFields,
      shopItems: shopItems.filter((item) => item.direction && item.itemId) as unknown as Prisma.InputJsonValue,
      customMessages: customMessages as unknown as Prisma.InputJsonValue,
      defaultMessages: defaultMessages as unknown as Prisma.InputJsonValue,
    },
  });

  try {
    await writeNpcFiles(parsed.data);
  } catch (error) {
    return NextResponse.json(
      { npc, warning: `NPC salvo no banco, mas falhou ao gravar os arquivos: ${String(error)}` },
    );
  }

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "npc",
    entityId: npc.id,
    metadata: { name: npc.name, type: npc.type },
  });

  return NextResponse.json({ npc });
});

export const DELETE = withAudit(async function DELETE(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const npc = await prisma.npc.delete({ where: { id: Number(id) } });
  await deleteNpcFiles(npc.name).catch(() => undefined);

  await logAudit({
    accountId: Number(session.user.id),
    action: "delete",
    entity: "npc",
    entityId: id,
  });

  return NextResponse.json({ success: true });
});
