import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";

import { NextResponse } from "next/server";

import { requireSession } from "@/lib/api-guard";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MAX_TICKET_MEDIA_BYTES, detectTicketMedia, ticketMediaStorageDir, ticketMediaUrl } from "@/lib/ticket-media";

type Params = { params: Promise<{ id: string; messageId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { session, response } = await requireSession();
  if (response) return response;

  const { id, messageId } = await params;
  const ticket = await prisma.ticket.findUnique({ where: { id: Number(id) } });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket não encontrado." }, { status: 404 });
  }

  const isOwner = ticket.accountId === Number(session.user.id);
  if (!isOwner && !isAdmin(session.user.groupId)) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
  }

  const message = await prisma.ticketMessage.findUnique({ where: { id: Number(messageId) } });
  if (!message || message.ticketId !== ticket.id) {
    return NextResponse.json({ error: "Mensagem não encontrada." }, { status: 404 });
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
  if (buffer.length > MAX_TICKET_MEDIA_BYTES) {
    return NextResponse.json({ error: "Arquivo maior que 25MB." }, { status: 413 });
  }

  const detected = detectTicketMedia(buffer);
  if (!detected) {
    return NextResponse.json(
      { error: "Formato inválido — envie uma imagem (png/gif/jpg/webp) ou vídeo (mp4/webm)." },
      { status: 422 },
    );
  }

  const filename = `${randomUUID()}.${detected.extension}`;
  const dir = ticketMediaStorageDir(message.id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(`${dir}/${filename}`, buffer);

  const url = ticketMediaUrl(message.id, filename);
  const attachment = await prisma.ticketMessageAttachment.create({
    data: { messageId: message.id, kind: detected.kind, url },
  });

  return NextResponse.json({ attachment }, { status: 201 });
}
