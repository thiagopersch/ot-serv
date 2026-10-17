import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { buildPaginatedResult, parsePaginationParams } from "@/lib/pagination";
import { publicPlayerVisibilityWhere } from "@/lib/public-player-visibility";

type DeathKiller = { name: string; type: "player" | "monster" };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { page, pageSize, search } = parsePaginationParams(url);
  // Filtro exato por personagem (ex.: link da página do personagem) — `search` é LIKE.
  const playerName = url.searchParams.get("player")?.trim() || undefined;

  const where: Prisma.PlayerDeathWhereInput = {
    player: {
      ...publicPlayerVisibilityWhere(),
      AND: [
        ...(search ? [{ name: { contains: search } }] : []),
        ...(playerName ? [{ name: playerName }] : []),
      ],
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
        details: true,
        items: { orderBy: { id: "asc" } },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.playerDeath.count({ where }),
  ]);

  const itemIds = [...new Set(deaths.flatMap((death) => death.items.map((item) => item.itemId)))];
  const images = itemIds.length
    ? await prisma.entityImage.findMany({
        where: { entityType: "item", entityId: { in: itemIds } },
        select: { entityId: true, extension: true, updatedAt: true },
      })
    : [];
  const imageByEntityId = new Map(images.map((image) => [image.entityId, image]));

  const result = deaths.map((death) => {
    const killers = new Map<string, DeathKiller>();
    for (const killer of death.killers) {
      for (const pk of killer.playerKillers) {
        killers.set(`player:${pk.player.name}`, { name: pk.player.name, type: "player" });
      }
      for (const ek of killer.environmentKillers) {
        killers.set(`monster:${ek.name}`, { name: ek.name, type: "monster" });
      }
    }

    return {
      id: death.id,
      date: death.date,
      level: death.level,
      playerName: death.player.name,
      killers: [...killers.values()],
      details: death.details
        ? {
            blessed: death.details.blessed,
            blessings: death.details.blessings,
            levelBefore: death.details.levelBefore,
            levelAfter: death.details.levelAfter,
          }
        : null,
      items: death.items.map((item) => {
        const image = imageByEntityId.get(item.itemId);
        return {
          itemId: item.itemId,
          count: item.count,
          name: item.name,
          image: image
            ? { extension: image.extension, updatedAt: image.updatedAt, looktype: null }
            : null,
        };
      }),
    };
  });

  return NextResponse.json(buildPaginatedResult(result, total, page, pageSize));
}
