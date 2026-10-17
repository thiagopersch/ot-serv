import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { MyTicketsList } from "@/components/shared/my-tickets-list";

export const metadata: Metadata = {
  title: "Meus tickets",
};

export default async function MyTicketsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/support/tickets");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Meus tickets</h1>
      <MyTicketsList />
    </div>
  );
}
