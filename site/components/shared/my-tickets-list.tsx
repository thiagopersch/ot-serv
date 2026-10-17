"use client";

import Link from "next/link";
import useSWR from "swr";
import dayjs from "dayjs";

import { fetcher } from "@/lib/fetcher";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Ticket = {
  id: number;
  subject: string;
  category: string;
  status: string;
  updatedAt: string;
};

const statusLabel: Record<string, string> = {
  open: "Aberto",
  answered: "Respondido",
  closed: "Fechado",
};

export function MyTicketsList() {
  const { data, isLoading } = useSWR<{ tickets: Ticket[] }>("/api/tickets", fetcher);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (!data?.tickets.length) {
    return <p className="text-muted-foreground">Você ainda não abriu nenhum ticket.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {data.tickets.map((ticket) => (
        <Link key={ticket.id} href={`/support/tickets/${ticket.id}`}>
          <Card className="transition-colors hover:bg-muted/50">
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium">{ticket.subject}</p>
                <p className="text-sm text-muted-foreground">
                  {ticket.category} · Atualizado em {dayjs(ticket.updatedAt).format("DD/MM/YYYY HH:mm")}
                </p>
              </div>
              <Badge>{statusLabel[ticket.status] ?? ticket.status}</Badge>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
