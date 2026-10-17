import { promises as fs } from "node:fs";

import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { postMediaStorageDir } from "@/lib/post-media";
import { postSchema } from "@/lib/validations/admin/post";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const GET = withAudit(async function GET(_request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const post = await prisma.post.findUnique({ where: { id: Number(id) } });

  if (!post) {
    return NextResponse.json({ error: "Post não encontrado." }, { status: 404 });
  }

  const image = await prisma.entityImage.findUnique({
    where: { entityType_entityId: { entityType: "post", entityId: post.id } },
    select: { extension: true, updatedAt: true },
  });

  return NextResponse.json({ post: { ...post, image } });
});

export const PATCH = withAudit(async function PATCH(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const body = await request.json();
  const parsed = postSchema.partial().safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 422 });
  }

  if (parsed.data.slug) {
    const duplicate = await prisma.post.findFirst({
      where: { slug: parsed.data.slug, NOT: { id: Number(id) } },
    });
    if (duplicate) {
      return NextResponse.json({ error: "Já existe um post com esse slug." }, { status: 409 });
    }
  }

  const current = await prisma.post.findUnique({ where: { id: Number(id) } });
  if (!current) {
    return NextResponse.json({ error: "Post não encontrado." }, { status: 404 });
  }

  const post = await prisma.post.update({
    where: { id: Number(id) },
    data: {
      ...parsed.data,
      content: parsed.data.content as Prisma.InputJsonValue | undefined,
      publishedAt:
        parsed.data.published && !current.published
          ? new Date()
          : parsed.data.published === false
            ? null
            : undefined,
    },
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "post",
    entityId: post.id,
    metadata: { title: post.title },
  });

  return NextResponse.json({ post });
});

export const DELETE = withAudit(async function DELETE(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  await prisma.post.delete({ where: { id: Number(id) } });

  await fs.rm(postMediaStorageDir(Number(id)), { recursive: true, force: true });

  await logAudit({
    accountId: Number(session.user.id),
    action: "delete",
    entity: "post",
    entityId: id,
  });

  return NextResponse.json({ success: true });
});
