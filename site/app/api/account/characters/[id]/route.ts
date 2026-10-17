import { NextResponse } from "next/server";

import { requireSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { characterCommentSchema } from "@/lib/validations/account";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { session, response } = await requireSession();
  if (response) return response;

  const { id } = await params;
  const player = await prisma.player.findUnique({
    where: { id: Number(id) },
    select: { id: true, name: true, description: true, accountId: true },
  });

  if (!player || player.accountId !== Number(session.user.id)) {
    return NextResponse.json({ error: "Personagem não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ player });
}

export async function PATCH(request: Request, { params }: Params) {
  const { session, response } = await requireSession();
  if (response) return response;

  const { id } = await params;
  const body = await request.json();
  const parsed = characterCommentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 422 }
    );
  }

  const player = await prisma.player.findUnique({
    where: { id: Number(id) },
    select: { id: true, accountId: true },
  });
  if (!player || player.accountId !== Number(session.user.id)) {
    return NextResponse.json({ error: "Personagem não encontrado." }, { status: 404 });
  }

  const updated = await prisma.player.update({
    where: { id: player.id },
    data: { description: parsed.data.description },
    select: { id: true, name: true, description: true },
  });

  return NextResponse.json({ player: updated });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { session, response } = await requireSession();
  if (response) return response;

  const { id } = await params;

  const player = await prisma.player.findUnique({
    where: { id: Number(id) },
    select: { id: true, accountId: true, deleted: true },
  });
  if (!player || player.accountId !== Number(session.user.id)) {
    return NextResponse.json({ error: "Personagem não encontrado." }, { status: 404 });
  }

  if (player.deleted !== 0) {
    return NextResponse.json({ error: "Personagem já removido." }, { status: 409 });
  }

  await prisma.player.update({
    where: { id: player.id },
    data: { deleted: Math.floor(Date.now() / 1000) },
  });

  return NextResponse.json({ success: true });
}
