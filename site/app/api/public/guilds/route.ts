import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { buildPaginatedResult, parsePaginationParams } from "@/lib/pagination";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { page, pageSize, search } = parsePaginationParams(url);

  const where: Prisma.GuildWhereInput = search ? { name: { contains: search } } : {};

  const [guilds, total] = await Promise.all([
    prisma.guild.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        owner: { select: { name: true } },
        ranks: { select: { id: true } },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.guild.count({ where }),
  ]);

  const allRankIds = guilds.flatMap((guild) => guild.ranks.map((rank) => rank.id));

  const memberCounts = allRankIds.length
    ? await prisma.player.groupBy({
        by: ["rankId"],
        where: { rankId: { in: allRankIds }, deleted: 0 },
        _count: { _all: true },
      })
    : [];

  const countByRank = new Map(memberCounts.map((entry) => [entry.rankId, entry._count._all]));

  const result = guilds.map((guild) => ({
    id: guild.id,
    name: guild.name,
    motd: guild.motd,
    owner: guild.owner.name,
    memberCount: guild.ranks.reduce((sum, rank) => sum + (countByRank.get(rank.id) ?? 0), 0),
  }));

  return NextResponse.json(buildPaginatedResult(result, total, page, pageSize));
}
