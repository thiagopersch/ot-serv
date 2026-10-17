import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { buildPaginatedResult, parsePaginationParams } from "@/lib/pagination";
import { withAudit } from "@/lib/api-audit-wrapper";

export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const url = new URL(request.url);
  const { page, pageSize, search } = parsePaginationParams(url);

  const where: Prisma.HouseWhereInput = search ? { name: { contains: search } } : {};

  const [houses, total] = await Promise.all([
    prisma.house.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.house.count({ where }),
  ]);

  const townIds = [...new Set(houses.map((house) => house.town))];
  const ownerIds = [...new Set(houses.map((house) => house.owner).filter((id) => id > 0))];

  const [towns, owners] = await Promise.all([
    townIds.length
      ? prisma.town.findMany({ where: { id: { in: townIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
    ownerIds.length
      ? prisma.player.findMany({ where: { id: { in: ownerIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);
  const townNameById = new Map(towns.map((town) => [town.id, town.name]));
  const ownerNameById = new Map(owners.map((owner) => [owner.id, owner.name]));

  const data = houses.map((house) => ({
    ...house,
    townName: townNameById.get(house.town) ?? null,
    ownerName: house.owner > 0 ? (ownerNameById.get(house.owner) ?? null) : null,
  }));

  return NextResponse.json(buildPaginatedResult(data, total, page, pageSize));
});
