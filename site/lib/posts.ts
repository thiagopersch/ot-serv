import { prisma } from "@/lib/prisma";
import type { PostPage } from "@/lib/validations/admin/post";

/** Posts publicados de uma página de gameplay (towns/systems/events/quests/raids/tasks/
 * missions), já com a imagem de capa resolvida em lote (evita N+1 uma imagem por vez). */
export async function getPublishedPostsForPage(page: PostPage) {
  const posts = await prisma.post.findMany({
    where: { page, published: true },
    orderBy: { publishedAt: "desc" },
    select: { id: true, title: true, slug: true, excerpt: true },
  });

  const ids = posts.map((post) => post.id);
  const images = ids.length
    ? await prisma.entityImage.findMany({
        where: { entityType: "post", entityId: { in: ids } },
        select: { entityId: true, extension: true, updatedAt: true },
      })
    : [];
  const imageByPostId = new Map(images.map((image) => [image.entityId, image]));

  return posts.map((post) => ({
    ...post,
    image: imageByPostId.get(post.id)
      ? {
          extension: imageByPostId.get(post.id)!.extension,
          updatedAt: imageByPostId.get(post.id)!.updatedAt.toISOString(),
          looktype: null,
        }
      : null,
  }));
}
