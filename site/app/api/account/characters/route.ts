import { NextResponse } from "next/server";

import { requireSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { createCharacterSchema } from "@/lib/validations/account";

/** Cidade inicial dos personagens novos (mesmo valor usado no seed do projeto). */
const DEFAULT_TOWN_ID = 1;
const DEFAULT_RANK_ID = 0;
const PLAYER_GROUP_ID = 1;

export async function POST(request: Request) {
  const { session, response } = await requireSession();
  if (response) return response;

  const body = await request.json();
  const parsed = createCharacterSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 422 }
    );
  }

  const vocation = await prisma.vocation.findUnique({ where: { id: parsed.data.vocationId } });
  if (!vocation || !vocation.published) {
    return NextResponse.json({ error: "Vocação inválida." }, { status: 422 });
  }

  const existing = await prisma.player.findUnique({
    where: { name_deleted: { name: parsed.data.name, deleted: 0 } },
  });
  if (existing) {
    return NextResponse.json({ error: "Já existe um personagem com esse nome." }, { status: 409 });
  }

  const player = await prisma.player.create({
    data: {
      name: parsed.data.name,
      sex: parsed.data.sex,
      vocation: parsed.data.vocationId,
      accountId: Number(session.user.id),
      groupId: PLAYER_GROUP_ID,
      rankId: DEFAULT_RANK_ID,
      townId: DEFAULT_TOWN_ID,
      conditions: Buffer.alloc(0),
    },
    select: { id: true, name: true },
  });

  return NextResponse.json({ player }, { status: 201 });
}
