import { NextResponse } from "next/server";

import { requireSession } from "@/lib/api-guard";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ticketMessageSchema } from "@/lib/validations/ticket";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { session, response } = await requireSession();
  if (response) return response;

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({ where: { id: Number(id) } });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket não encontrado." }, { status: 404 });
  }

  const staff = isAdmin(session.user.groupId);
  const isOwner = ticket.accountId === Number(session.user.id);

  if (!isOwner && !staff) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
  }

  const body = await request.json();
  const parsed = ticketMessageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Mensagem inválida." }, { status: 422 });
  }

  const message = await prisma.ticketMessage.create({
    data: {
      ticketId: ticket.id,
      accountId: Number(session.user.id),
      isStaff: staff,
      message: parsed.data.message,
    },
  });

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { status: staff ? "answered" : "open" },
  });

  return NextResponse.json({ message }, { status: 201 });
}
