import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { buildPaginatedResult, parsePaginationParams } from "@/lib/pagination";
import { publicPlayerVisibilityWhere } from "@/lib/public-player-visibility";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { page, pageSize, search } = parsePaginationParams(url);

  const where: Prisma.PlayerDeathWhereInput = {
    player: {
      ...publicPlayerVisibilityWhere(),
      AND: search ? [{ name: { contains: search } }] : undefined,
    },
  };

  const [deaths, total] = await Promise.all([
    prisma.playerDeath.findMany({
      where,
      orderBy: { date: "desc" },
      include: {
        player: { select: { name: true } },
        killers: {
          include: {
            playerKillers: { include: { player: { select: { name: true } } } },
            environmentKillers: { select: { name: true } },
          },
        },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.playerDeath.count({ where }),
  ]);

  const result = deaths.map((death) => ({
    id: death.id,
    date: death.date,
    level: death.level,
    playerName: death.player.name,
    killerNames: death.killers.flatMap((killer) => [
      ...killer.playerKillers.map((pk) => pk.player.name),
      ...killer.environmentKillers.map((ek) => ek.name),
    ]),
  }));

  return NextResponse.json(buildPaginatedResult(result, total, page, pageSize));
}
