import type { Metadata } from "next";

import { getPublishedPostsForPage } from "@/lib/posts";
import { PostCardGrid } from "@/components/shared/post-card-grid";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cidades/Locais",
};

export default async function PublicTownsPage() {
  const posts = await getPublishedPostsForPage("town");

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Cidades/Locais</h1>
      <PostCardGrid posts={posts} emptyLabel="Nenhuma cidade publicada ainda." />
    </div>
  );
}
