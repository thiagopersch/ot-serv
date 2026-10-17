"use client";

import { useState } from "react";
import useSWR from "swr";
import dayjs from "dayjs";
import { toast } from "sonner";

import type { JSONContent } from "@tiptap/react";

import { fetcher } from "@/lib/fetcher";
import { TICKET_STATUSES } from "@/lib/validations/ticket";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RichTextViewer } from "@/components/shared/rich-text-viewer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TicketAttachment = { id: number; kind: string; url: string };

type TicketMessage = {
  id: number;
  message: string;
  isStaff: boolean;
  accountId: number;
  createdAt: string;
  attachments: TicketAttachment[];
};

type Ticket = {
  id: number;
  subject: string;
  category: string;
  status: string;
  accountId: number;
  messages: TicketMessage[];
};

/** Mensagens antigas foram salvas como texto puro; mensagens novas guardam o JSON do
 * Tiptap serializado (ver `new-ticket-form.tsx`). Detecta qual é qual pelo parse. */
function parseTiptapMessage(message: string): JSONContent | null {
  try {
    const parsed = JSON.parse(message) as JSONContent;
    return parsed && typeof parsed === "object" && parsed.type === "doc" ? parsed : null;
  } catch {
    return null; // não é JSON — mensagem antiga em texto puro, cai no fallback abaixo
  }
}

function TicketMessageBody({ message }: { message: string }) {
  const parsed = parseTiptapMessage(message);
  if (parsed) {
    return <RichTextViewer content={parsed} className="text-sm" />;
  }
  return <p className="whitespace-pre-wrap">{message}</p>;
}

const statusLabel: Record<string, string> = {
  open: "Aberto",
  answered: "Respondido",
  closed: "Fechado",
};

export function TicketThread({ ticketId, isStaff = false }: { ticketId: number; isStaff?: boolean }) {
  const { data, isLoading, mutate } = useSWR<{ ticket: Ticket }>(
    `/api/tickets/${ticketId}`,
    fetcher
  );
  const [reply, setReply] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function sendReply() {
    if (!reply.trim()) return;
    setIsSubmitting(true);

    const response = await fetch(`/api/tickets/${ticketId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: reply }),
    });

    if (!response.ok) {
      setIsSubmitting(false);
      toast.error("Não foi possível enviar a mensagem.");
      return;
    }

    const { message } = await response.json();

    for (const file of replyFiles) {
      const formData = new FormData();
      formData.append("file", file);
      await fetch(`/api/tickets/${ticketId}/messages/${message.id}/media`, {
        method: "POST",
        body: formData,
      });
    }

    setIsSubmitting(false);
    setReply("");
    setReplyFiles([]);
    mutate();
  }

  async function changeStatus(status: string) {
    const response = await fetch(`/api/admin/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      toast.error("Não foi possível atualizar o status.");
      return;
    }

    toast.success("Status atualizado.");
    mutate();
  }

  if (isLoading || !data?.ticket) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-72" />
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  const { ticket } = data;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>{ticket.subject}</CardTitle>
          <CardDescription>Categoria: {ticket.category}</CardDescription>
        </div>
        {isStaff ? (
          <Select
            value={ticket.status}
            onValueChange={(value) => value && changeStatus(value)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TICKET_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {statusLabel[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Badge>{statusLabel[ticket.status] ?? ticket.status}</Badge>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1">
          {ticket.messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "max-w-lg rounded-md border p-3 text-sm",
                message.isStaff ? "self-start bg-muted" : "self-end bg-primary/10"
              )}
            >
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                {message.isStaff ? "Suporte" : "Você"} ·{" "}
                {dayjs(message.createdAt).format("DD/MM/YYYY HH:mm")}
              </p>
              <TicketMessageBody message={message.message} />
              {message.attachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {message.attachments.map((attachment) =>
                    attachment.kind === "video" ? (
                      <video
                        key={attachment.id}
                        src={attachment.url}
                        controls
                        className="max-h-48 rounded-md border border-border"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element -- anexo enviado pelo usuário, servido estático de public/storage
                      <img
                        key={attachment.id}
                        src={attachment.url}
                        alt=""
                        className="max-h-48 rounded-md border border-border object-contain"
                      />
                    ),
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {ticket.status !== "closed" && (
          <div className="flex flex-col gap-2 border-t pt-4">
            <Textarea
              rows={3}
              placeholder="Escreva sua resposta..."
              value={reply}
              onChange={(event) => setReply(event.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="reply-attachments">
                Anexos (imagens ou vídeos, opcional)
              </label>
              <input
                id="reply-attachments"
                type="file"
                multiple
                accept="image/png,image/gif,image/jpeg,image/webp,video/mp4,video/webm"
                onChange={(event) => setReplyFiles(Array.from(event.target.files ?? []))}
                className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
              />
            </div>
            <Button onClick={sendReply} disabled={isSubmitting} className="self-end">
              {isSubmitting ? "Enviando..." : "Responder"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
