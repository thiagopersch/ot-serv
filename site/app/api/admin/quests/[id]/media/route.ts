import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";

import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { MAX_QUEST_IMAGE_BYTES, detectQuestImage, questMediaStorageDir, questMediaUrl } from "@/lib/quest-media";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const POST = withAudit(async function POST(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const questId = Number(id);
  if (!Number.isInteger(questId)) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  const quest = await prisma.quest.findUnique({ where: { id: questId }, select: { id: true } });
  if (!quest) {
    return NextResponse.json({ error: "Quest não encontrada." }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 422 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) {
    return NextResponse.json({ error: "Arquivo vazio." }, { status: 422 });
  }
  if (buffer.length > MAX_QUEST_IMAGE_BYTES) {
    return NextResponse.json({ error: "Arquivo maior que 5MB." }, { status: 413 });
  }

  const detected = detectQuestImage(buffer);
  if (!detected) {
    return NextResponse.json(
      { error: "Formato inválido — envie uma imagem (png/gif/jpg/webp)." },
      { status: 422 },
    );
  }

  const filename = `${randomUUID()}.${detected.extension}`;
  const dir = questMediaStorageDir(questId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(`${dir}/${filename}`, buffer);

  const imageUrl = questMediaUrl(questId, filename);
  await prisma.quest.update({ where: { id: questId }, data: { imageUrl } });

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "quest",
    entityId: questId,
    metadata: { imageUrl },
  });

  return NextResponse.json({ imageUrl });
});

export const DELETE = withAudit(async function DELETE(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const questId = Number(id);
  if (!Number.isInteger(questId)) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  await prisma.quest.update({ where: { id: questId }, data: { imageUrl: null } });

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "quest",
    entityId: questId,
    metadata: { imageUrl: null },
  });

  return NextResponse.json({ success: true });
});
