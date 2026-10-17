import Link from "next/link";

import { entityImageUrl } from "@/lib/entity-image";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { EntityImageInfo } from "@/components/shared/use-entity-images";

export type PostTableRowData = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  image: EntityImageInfo | null;
};

type PostTableListProps = {
  posts: PostTableRowData[];
  emptyLabel?: string;
};

/** Tabela (imagem / nome / início da descrição) usada nas páginas de gameplay que viraram
 * CMS: quests, raids, tarefas e missões. */
export function PostTableList({ posts, emptyLabel = "Nenhum conteúdo publicado ainda." }: PostTableListProps) {
  if (posts.length === 0) {
    return <p className="text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-20">Imagem</TableHead>
          <TableHead>Nome</TableHead>
          <TableHead>Descrição</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {posts.map((post) => (
          <TableRow key={post.id}>
            <TableCell>
              <div className="size-12 overflow-hidden rounded-md border border-border bg-muted">
                {post.image?.extension && post.image.updatedAt && (
                  // eslint-disable-next-line @next/next/no-img-element -- imagem de capa enviada pelo admin, servida estática de public/storage
                  <img
                    src={entityImageUrl("post", post.id, post.image.extension, new Date(post.image.updatedAt))}
                    alt={post.title}
                    className="size-full object-cover"
                  />
                )}
              </div>
            </TableCell>
            <TableCell className="font-medium">
              <Link href={`/posts/${post.slug}`} className="hover:underline">
                {post.title}
              </Link>
            </TableCell>
            <TableCell className="max-w-md truncate text-muted-foreground">{post.excerpt}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
