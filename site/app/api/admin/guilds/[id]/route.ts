import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { guildUpdateSchema } from "@/lib/validations/admin/guild";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const GET = withAudit(async function GET(_request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const guild = await prisma.guild.findUnique({
    where: { id: Number(id) },
    include: {
      owner: { select: { id: true, name: true } },
      ranks: { orderBy: { level: "desc" } },
      wars: { include: { enemy: { select: { id: true, name: true } } } },
      enemyWars: { include: { guild: { select: { id: true, name: true } } } },
      invites: { include: { player: { select: { id: true, name: true } } } },
    },
  });

  if (!guild) {
    return NextResponse.json({ error: "Guild não encontrada." }, { status: 404 });
  }

  return NextResponse.json({ guild });
});

export const PATCH = withAudit(async function PATCH(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const guildId = Number(id);
  const body = await request.json();
  const parsed = guildUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 422 }
    );
  }

  const existing = await prisma.guild.findUnique({ where: { id: guildId }, include: { ranks: true } });
  if (!existing) {
    return NextResponse.json({ error: "Guild não encontrada." }, { status: 404 });
  }

  const owner = await prisma.player.findUnique({ where: { id: parsed.data.ownerId } });
  if (!owner) {
    return NextResponse.json({ error: "Dono informado não existe." }, { status: 422 });
  }

  const duplicate = await prisma.guild.findFirst({
    where: { name: parsed.data.name, worldId: existing.worldId, NOT: { id: guildId } },
  });
  if (duplicate) {
    return NextResponse.json({ error: "Já existe uma guild com esse nome." }, { status: 409 });
  }

  const keepRankIds = new Set(parsed.data.ranks.filter((rank) => rank.id != null).map((rank) => rank.id as number));
  const rankIdsToRemove = existing.ranks.filter((rank) => !keepRankIds.has(rank.id)).map((rank) => rank.id);

  const guild = await prisma.$transaction(async (tx) => {
    if (rankIdsToRemove.length > 0) {
      await tx.guildRank.deleteMany({ where: { id: { in: rankIdsToRemove } } });
    }

    for (const rank of parsed.data.ranks) {
      if (rank.id != null) {
        await tx.guildRank.update({ where: { id: rank.id }, data: { name: rank.name, level: rank.level } });
      } else {
        await tx.guildRank.create({ data: { guildId, name: rank.name, level: rank.level } });
      }
    }

    return tx.guild.update({
      where: { id: guildId },
      data: { name: parsed.data.name, motd: parsed.data.motd, ownerId: parsed.data.ownerId },
    });
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "guild",
    entityId: guild.id,
    metadata: { name: guild.name },
  });

  return NextResponse.json({ guild });
});
