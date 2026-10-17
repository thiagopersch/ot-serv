import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { TicketThread } from "@/components/shared/ticket-thread";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user) {
    redirect(`/login?callbackUrl=/support/tickets/${id}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <TicketThread ticketId={Number(id)} />
    </div>
  );
}
