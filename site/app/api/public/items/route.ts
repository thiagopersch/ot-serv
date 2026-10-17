import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { buildPaginatedResult, parsePaginationParams } from "@/lib/pagination";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { page, pageSize, search } = parsePaginationParams(url);

  const where: Prisma.ItemWhereInput = search
    ? { published: true, name: { contains: search } }
    : { published: true };

  const [items, total] = await Promise.all([
    prisma.item.findMany({
      where,
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        article: true,
        description: true,
        attack: true,
        defense: true,
        armor: true,
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.item.count({ where }),
  ]);

  const ids = items.map((item) => item.id);
  const images = ids.length
    ? await prisma.entityImage.findMany({
        where: { entityType: "item", entityId: { in: ids } },
        select: { entityId: true, extension: true, updatedAt: true },
      })
    : [];
  const imageByEntityId = new Map(
    images.map((image) => [image.entityId, image]),
  );

  return NextResponse.json(
    buildPaginatedResult(
      items.map((item) => ({
        ...item,
        image: imageByEntityId.get(item.id) ?? null,
      })),
      total,
      page,
      pageSize,
    ),
  );
}
