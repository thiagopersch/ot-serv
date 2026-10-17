import type { Metadata } from "next";

import { getPublishedPostsForPage } from "@/lib/posts";
import { PostCardGrid } from "@/components/shared/post-card-grid";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Regras",
};

export default async function RulesPage() {
  const posts = await getPublishedPostsForPage("rules");

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Regras</h1>
      <PostCardGrid posts={posts} emptyLabel="Nenhuma regra publicada ainda." />
    </div>
  );
}
