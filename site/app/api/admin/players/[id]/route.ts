import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { playerToFormInput, playerFormToPrismaData } from "@/lib/player-mapper";
import { playerUpdateSchema } from "@/lib/validations/admin/player";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const GET = withAudit(async function GET(_request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const player = await prisma.player.findUnique({ where: { id: Number(id) } });

  if (!player) {
    return NextResponse.json({ error: "Jogador não encontrado." }, { status: 404 });
  }

  return NextResponse.json({
    player: playerToFormInput(player),
    readOnly: {
      lastlogin: player.lastlogin,
      lastip: player.lastip,
      lastlogout: player.lastlogout,
      stamina: player.stamina.toString(),
      createdAt: player.createdAt,
    },
  });
});

export const PATCH = withAudit(async function PATCH(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const body = await request.json();
  const parsed = playerUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 422 }
    );
  }

  const duplicate = await prisma.player.findFirst({
    where: { name: parsed.data.name, deleted: parsed.data.deleted, NOT: { id: Number(id) } },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: "Já existe um personagem com esse nome (mesmo status de deletado)." },
      { status: 409 }
    );
  }

  const account = await prisma.account.findUnique({ where: { id: parsed.data.accountId } });
  if (!account) {
    return NextResponse.json({ error: "Conta informada não existe." }, { status: 422 });
  }

  const player = await prisma.player.update({
    where: { id: Number(id) },
    data: playerFormToPrismaData(parsed.data),
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "player",
    entityId: player.id,
    metadata: { name: player.name },
  });

  return NextResponse.json({ player: playerToFormInput(player) });
});
