import { TicketThread } from "@/components/shared/ticket-thread";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export default async function AdminTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/tickets" />
      <TicketThread ticketId={Number(id)} isStaff />
    </div>
  );
}
