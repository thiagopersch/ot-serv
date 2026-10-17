import type { Metadata } from "next";

import { getPublishedPostsForPage } from "@/lib/posts";
import { PostTableList } from "@/components/shared/post-table-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Quests",
};

export default async function PublicQuestsPage() {
  const posts = await getPublishedPostsForPage("quest");

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Quests</h1>
      <PostTableList posts={posts} emptyLabel="Nenhuma quest publicada ainda." />
    </div>
  );
}
