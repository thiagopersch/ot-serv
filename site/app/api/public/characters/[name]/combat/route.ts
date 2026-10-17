import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { ACCOUNT_MANAGER_NAME, PUBLIC_LISTING_GROUP_ID_LIMIT } from "@/lib/public-player-visibility";
import { getFragCounts } from "@/lib/character-profile";

type Params = { params: Promise<{ name: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);

  if (decodedName === ACCOUNT_MANAGER_NAME) {
    return NextResponse.json({ error: "Personagem não encontrado." }, { status: 404 });
  }

  const player = await prisma.player.findFirst({
    where: { name: decodedName, deleted: 0, groupId: { lt: PUBLIC_LISTING_GROUP_ID_LIMIT } },
    select: { id: true },
  });

  if (!player) {
    return NextResponse.json({ error: "Personagem não encontrado." }, { status: 404 });
  }

  const [fragCounts, totalDeaths, killerRows] = await Promise.all([
    getFragCounts(player.id),
    prisma.playerDeath.count({ where: { playerId: player.id } }),
    prisma.playerKiller.findMany({
      where: { playerId: player.id },
      include: {
        killer: {
          include: {
            death: {
              include: { player: { select: { name: true, sex: true, resets: true } } },
            },
          },
        },
      },
      orderBy: { killer: { death: { date: "desc" } } },
    }),
  ]);

  const frags = killerRows.map((row) => ({
    date: row.killer.death.date,
    victimName: row.killer.death.player.name,
    victimSex: row.killer.death.player.sex,
    victimLevel: row.killer.death.level,
    victimResets: row.killer.death.player.resets,
    unjustified: row.killer.unjustified,
  }));

  return NextResponse.json({
    fragCounts,
    totalKills: frags.length,
    totalDeaths,
    justifiedFrags: frags.filter((f) => !f.unjustified),
    unjustifiedFrags: frags.filter((f) => f.unjustified),
  });
}
