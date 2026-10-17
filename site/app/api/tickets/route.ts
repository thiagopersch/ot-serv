import { NextResponse } from "next/server";

import { requireSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { createTicketSchema } from "@/lib/validations/ticket";

export async function GET() {
  const { session, response } = await requireSession();
  if (response) return response;

  const tickets = await prisma.ticket.findMany({
    where: { accountId: Number(session.user.id) },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ tickets });
}

export async function POST(request: Request) {
  const { session, response } = await requireSession();
  if (response) return response;

  const body = await request.json();
  const parsed = createTicketSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const ticket = await prisma.ticket.create({
    data: {
      accountId: Number(session.user.id),
      subject: parsed.data.subject,
      category: parsed.data.category,
      messages: {
        create: {
          accountId: Number(session.user.id),
          message: parsed.data.message,
          isStaff: false,
        },
      },
    },
    include: { messages: true },
  });

  return NextResponse.json({ ticket }, { status: 201 });
}
