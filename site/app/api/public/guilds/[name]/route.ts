import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { publicPlayerVisibilityWhere } from "@/lib/public-player-visibility";

type Params = { params: Promise<{ name: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { name } = await params;

  const guild = await prisma.guild.findFirst({
    where: { name: decodeURIComponent(name) },
    include: {
      owner: { select: { name: true } },
      ranks: { orderBy: { level: "desc" } },
    },
  });

  if (!guild) {
    return NextResponse.json({ error: "Guild não encontrada." }, { status: 404 });
  }

  const rankIds = guild.ranks.map((rank) => rank.id);
  const members = rankIds.length
    ? await prisma.player.findMany({
        where: { rankId: { in: rankIds }, deleted: 0, ...publicPlayerVisibilityWhere() },
        select: { id: true, name: true, level: true, rankId: true, online: true },
        orderBy: { level: "desc" },
      })
    : [];

  const rankNameById = new Map(guild.ranks.map((rank) => [rank.id, rank.name]));

  return NextResponse.json({
    guild: {
      id: guild.id,
      name: guild.name,
      motd: guild.motd,
      owner: guild.owner.name,
      members: members.map((member) => ({
        ...member,
        rankName: rankNameById.get(member.rankId) ?? "Membro",
      })),
    },
  });
}
