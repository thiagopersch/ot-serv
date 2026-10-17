import { NextResponse } from "next/server";
import { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { buildPaginatedResult, parseIdsParam, parsePaginationParams } from "@/lib/pagination";
import { defaultPostContent, postSchema } from "@/lib/validations/admin/post";
import { withAudit } from "@/lib/api-audit-wrapper";

export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const url = new URL(request.url);

  const idsParam = parseIdsParam(url);
  if (idsParam) {
    const postsById = await prisma.post.findMany({ where: { id: { in: idsParam } } });
    return NextResponse.json(buildPaginatedResult(postsById, postsById.length, 1, postsById.length || 1));
  }

  const { page, pageSize, search } = parsePaginationParams(url);
  const pageFilter = url.searchParams.get("postPage");
  const published = url.searchParams.get("published");

  const where: Prisma.PostWhereInput = {
    ...(search ? { OR: [{ title: { contains: search } }, { slug: { contains: search } }] } : {}),
    ...(pageFilter ? { page: pageFilter } : {}),
    ...(published === "true" || published === "false" ? { published: published === "true" } : {}),
  };

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
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
});

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const body = await request.json();
  const parsed = postSchema.partial({ content: true }).safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 422 });
  }

  const existing = await prisma.post.findUnique({ where: { slug: parsed.data.slug } });
  if (existing) {
    return NextResponse.json({ error: "Já existe um post com esse slug." }, { status: 409 });
  }

  const post = await prisma.post.create({
    data: {
      ...parsed.data,
      content: (parsed.data.content ?? defaultPostContent) as Prisma.InputJsonValue,
      authorId: Number(session.user.id),
      publishedAt: parsed.data.published ? new Date() : null,
    },
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "create",
    entity: "post",
    entityId: post.id,
    metadata: { title: post.title },
  });

  return NextResponse.json({ post }, { status: 201 });
});
