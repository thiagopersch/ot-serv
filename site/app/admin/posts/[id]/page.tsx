import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { PostForm } from "@/components/admin/posts/post-form";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Editar post",
};

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) notFound();

  const [post, image] = await Promise.all([
    prisma.post.findUnique({ where: { id: postId } }),
    prisma.entityImage.findUnique({
      where: { entityType_entityId: { entityType: "post", entityId: postId } },
      select: { extension: true, updatedAt: true },
    }),
  ]);
  if (!post) notFound();

  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/posts" />
      <div>
        <h1 className="text-2xl font-semibold">Editar post: {post.title || "Sem título"}</h1>
        <p className="text-muted-foreground">
          As alterações são salvas automaticamente 5 segundos após você sair de um campo.
        </p>
      </div>
      <PostForm
        post={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          page: post.page,
          excerpt: post.excerpt,
          content: post.content,
          published: post.published,
          image: image
            ? { extension: image.extension, updatedAt: image.updatedAt.toISOString(), looktype: null }
            : null,
        }}
      />
    </div>
  );
}
