import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { buildPaginatedResult, parsePaginationParams } from "@/lib/pagination";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { page, pageSize, search } = parsePaginationParams(url);

  const where: Prisma.VocationWhereInput = search
    ? { publishedGameplay: true, name: { contains: search } }
    : { publishedGameplay: true };

  const [vocations, total] = await Promise.all([
    prisma.vocation.findMany({
      where,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.vocation.count({ where }),
  ]);

  const ids = vocations.map((vocation) => vocation.id);
  const images = ids.length
    ? await prisma.entityImage.findMany({
        where: { entityType: "vocation", entityId: { in: ids } },
        select: { entityId: true, extension: true, updatedAt: true },
      })
    : [];
  const imageByEntityId = new Map(images.map((image) => [image.entityId, image]));

  return NextResponse.json(
    buildPaginatedResult(
      vocations.map((vocation) => ({
        ...vocation,
        image: imageByEntityId.get(vocation.id) ?? null,
      })),
      total,
      page,
      pageSize
    )
  );
}
