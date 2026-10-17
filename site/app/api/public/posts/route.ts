import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { buildPaginatedResult, parsePaginationParams } from "@/lib/pagination";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { page, pageSize, search } = parsePaginationParams(url);
  const postPage = url.searchParams.get("postPage") ?? "home";

  const where: Prisma.PostWhereInput = {
    published: true,
    page: postPage,
    ...(search ? { title: { contains: search } } : {}),
  };

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      select: { id: true, title: true, slug: true, excerpt: true, publishedAt: true },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.post.count({ where }),
  ]);

  const ids = posts.map((post) => post.id);
  const images = ids.length
    ? await prisma.entityImage.findMany({
        where: { entityType: "post", entityId: { in: ids } },
        select: { entityId: true, extension: true, updatedAt: true },
      })
    : [];
  const imageByPostId = new Map(images.map((image) => [image.entityId, image]));

  return NextResponse.json(
    buildPaginatedResult(
      posts.map((post) => ({ ...post, image: imageByPostId.get(post.id) ?? null })),
      total,
      page,
      pageSize
    )
  );
}
