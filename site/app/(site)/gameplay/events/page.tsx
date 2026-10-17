import type { Metadata } from "next";

import { getPublishedPostsForPage } from "@/lib/posts";
import { PostCardGrid } from "@/components/shared/post-card-grid";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Eventos",
};

export default async function PublicEventsPage() {
  const posts = await getPublishedPostsForPage("event");

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Eventos</h1>
      <PostCardGrid posts={posts} emptyLabel="Nenhum evento publicado ainda." />
    </div>
  );
}
