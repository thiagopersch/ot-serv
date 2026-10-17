import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { NewTicketForm } from "@/components/shared/new-ticket-form";

export const metadata: Metadata = {
  title: "Abrir ticket",
};

export default async function NewTicketPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/support/new");
  }

  return (
    <div className="px-4 py-12">
      <NewTicketForm />
    </div>
  );
}
