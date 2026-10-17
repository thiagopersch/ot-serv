import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { buildPaginatedResult, parsePaginationParams } from "@/lib/pagination";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { page, pageSize, search } = parsePaginationParams(url);

  const where: Prisma.MonsterWhereInput = search
    ? { published: true, name: { contains: search } }
    : { published: true };

  const [monsters, total] = await Promise.all([
    prisma.monster.findMany({
      where,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        healthMax: true,
        experience: true,
        race: true,
        lookTypeId: true,
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.monster.count({ where }),
  ]);

  const ids = monsters.map((monster) => monster.id);
  const images = ids.length
    ? await prisma.entityImage.findMany({
        where: { entityType: "monster", entityId: { in: ids } },
        select: { entityId: true, extension: true, updatedAt: true },
      })
    : [];
  const imageByEntityId = new Map(images.map((image) => [image.entityId, image]));

  return NextResponse.json(
    buildPaginatedResult(
      monsters.map((monster) => ({
        ...monster,
        healthMax: monster.healthMax.toString(),
        image: imageByEntityId.get(monster.id) ?? null,
      })),
      total,
      page,
      pageSize
    )
  );
}
