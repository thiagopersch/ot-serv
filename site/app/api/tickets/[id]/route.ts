import { NextResponse } from "next/server";

import { requireSession } from "@/lib/api-guard";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { session, response } = await requireSession();
  if (response) return response;

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id: Number(id) },
    include: {
      messages: { orderBy: { createdAt: "asc" }, include: { attachments: true } },
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket não encontrado." }, { status: 404 });
  }

  const isOwner = ticket.accountId === Number(session.user.id);
  if (!isOwner && !isAdmin(session.user.groupId)) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
  }

  return NextResponse.json({ ticket });
}
