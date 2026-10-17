import type { Metadata } from "next";

import { getPublishedPostsForPage } from "@/lib/posts";
import { PostTableList } from "@/components/shared/post-table-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Missões",
};

export default async function PublicMissionsPage() {
  const posts = await getPublishedPostsForPage("mission");

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Missões</h1>
      <PostTableList posts={posts} emptyLabel="Nenhuma missão publicada ainda." />
    </div>
  );
}
