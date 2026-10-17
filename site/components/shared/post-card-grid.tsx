import Link from "next/link";

import { entityImageUrl } from "@/lib/entity-image";
import type { EntityImageInfo } from "@/components/shared/use-entity-images";

export type PostCardData = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  image: EntityImageInfo | null;
};

type PostCardGridProps = {
  posts: PostCardData[];
  emptyLabel?: string;
};

/** Grade de cards (capa + título + "Ler mais ->") usada nas páginas de gameplay que viraram
 * CMS: cidades, sistemas e eventos. */
export function PostCardGrid({ posts, emptyLabel = "Nenhum conteúdo publicado ainda." }: PostCardGridProps) {
  if (posts.length === 0) {
    return <p className="text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) => (
        <Link
          key={post.id}
          href={`/posts/${post.slug}`}
          className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/50"
        >
          <div
            className="aspect-video w-full bg-muted bg-cover bg-center"
            style={
              post.image?.extension && post.image.updatedAt
                ? {
                    backgroundImage: `url(${entityImageUrl("post", post.id, post.image.extension, new Date(post.image.updatedAt))})`,
                  }
                : undefined
            }
          />
          <div className="flex flex-1 flex-col gap-2 p-4">
            <h2 className="text-lg font-semibold">{post.title}</h2>
            {post.excerpt && <p className="line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p>}
            <span className="mt-auto pt-2 text-sm font-medium text-primary transition-transform group-hover:translate-x-1">
              Ler mais -&gt;
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
