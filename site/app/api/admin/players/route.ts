import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { buildPaginatedResult, parseIdsParam, parsePaginationParams } from "@/lib/pagination";
import { withAudit } from "@/lib/api-audit-wrapper";

function parseUnlockedVocations(value: string): number[] {
  return [...value.matchAll(/\d+/g)].map((match) => Number(match[0]));
}

const PLAYER_LIST_SELECT = {
  id: true,
  name: true,
  level: true,
  experience: true,
  vocation: true,
  groupId: true,
  online: true,
  deleted: true,
  accountId: true,
  sex: true,
  resets: true,
  health: true,
  healthmax: true,
  mana: true,
  manamax: true,
  cap: true,
  townId: true,
  age: true,
  balance: true,
  unlockedVocations: true,
} as const;

export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const url = new URL(request.url);

  const ids = parseIdsParam(url);
  if (ids) {
    const playersById = await prisma.player.findMany({ where: { id: { in: ids } }, select: PLAYER_LIST_SELECT });
    return NextResponse.json(buildPaginatedResult(playersById, playersById.length, 1, playersById.length || 1));
  }

  const { page, pageSize, search } = parsePaginationParams(url);

  const where: Prisma.PlayerWhereInput = search ? { name: { contains: search } } : {};

  const [players, total] = await Promise.all([
    prisma.player.findMany({
      where,
      orderBy: [{ level: "desc" }, { experience: "desc" }],
      select: PLAYER_LIST_SELECT,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.player.count({ where }),
  ]);

  const unlockedVocationIdsByPlayer = new Map(
    players.map((player) => [player.id, parseUnlockedVocations(player.unlockedVocations)])
  );

  const vocationIds = [
    ...new Set([
      ...players.map((player) => player.vocation),
      ...[...unlockedVocationIdsByPlayer.values()].flat(),
    ]),
  ];
  const townIds = [...new Set(players.map((player) => player.townId))];

  const [vocations, towns] = await Promise.all([
    vocationIds.length
      ? prisma.vocation.findMany({ where: { id: { in: vocationIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
    townIds.length
      ? prisma.town.findMany({ where: { id: { in: townIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);
  const vocationNameById = new Map(vocations.map((vocation) => [vocation.id, vocation.name]));
  const townNameById = new Map(towns.map((town) => [town.id, town.name]));

  const data = players.map(({ experience, ...player }) => ({
    ...player,
    experience: Number(experience),
    vocationName: vocationNameById.get(player.vocation) ?? "Desconhecida",
    townName: townNameById.get(player.townId) ?? null,
    unlockedVocations: (unlockedVocationIdsByPlayer.get(player.id) ?? []).map((id) => ({
      id,
      name: vocationNameById.get(id) ?? "Desconhecida",
    })),
  }));

  return NextResponse.json(buildPaginatedResult(data, total, page, pageSize));
});
