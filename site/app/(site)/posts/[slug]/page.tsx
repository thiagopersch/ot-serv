import type { Metadata } from "next";
import { notFound } from "next/navigation";
import dayjs from "dayjs";
import type { JSONContent } from "@tiptap/react";

import { prisma } from "@/lib/prisma";
import { entityImageUrl } from "@/lib/entity-image";
import { RichTextViewer } from "@/components/shared/rich-text-viewer";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await prisma.post.findFirst({ where: { slug, published: true } });

  return { title: post?.title ?? "Post não encontrado" };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = await prisma.post.findFirst({ where: { slug, published: true } });

  if (!post) {
    notFound();
  }

  const image = await prisma.entityImage.findUnique({
    where: { entityType_entityId: { entityType: "post", entityId: post.id } },
    select: { extension: true, updatedAt: true },
  });

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      {image && (
        // eslint-disable-next-line @next/next/no-img-element -- imagem de capa enviada pelo admin, servida estática de public/storage
        <img
          src={entityImageUrl("post", post.id, image.extension, image.updatedAt)}
          alt={post.title}
          className="mb-6 aspect-video w-full rounded-lg border border-border object-cover"
        />
      )}
      <h1 className="mb-2 text-3xl font-bold">{post.title}</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Publicado em {dayjs(post.publishedAt ?? post.createdAt).format("DD/MM/YYYY")}
      </p>
      <RichTextViewer content={post.content as JSONContent} />
    </article>
  );
}
