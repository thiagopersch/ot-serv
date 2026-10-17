import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;

  const post = await prisma.post.findFirst({
    where: { slug, published: true },
  });

  if (!post) {
    return NextResponse.json({ error: "Post não encontrado." }, { status: 404 });
  }

  const image = await prisma.entityImage.findUnique({
    where: { entityType_entityId: { entityType: "post", entityId: post.id } },
    select: { extension: true, updatedAt: true },
  });

  return NextResponse.json({ post: { ...post, image } });
}
