import { z } from "zod";

export const TICKET_CATEGORIES = [
  "Conta",
  "Pagamento",
  "Bug",
  "Denúncia",
  "Outro",
] as const;

/** Nós do Tiptap que valem como "conteúdo" mesmo sem texto (mídia embutida). */
const NON_TEXT_CONTENT_NODES = new Set(["image", "video", "audio", "table"]);

/** Verifica recursivamente se o JSON do Tiptap tem algum texto não-vazio ou nó de mídia —
 * usado para rejeitar mensagens "em branco" (só parágrafos vazios) no schema abaixo. */
function hasTiptapContent(raw: string): boolean {
  try {
    const json = JSON.parse(raw) as { type?: string; text?: string; content?: unknown[] };
    const visit = (node: { type?: string; text?: string; content?: unknown[] }): boolean => {
      if (node.type && NON_TEXT_CONTENT_NODES.has(node.type)) return true;
      if (typeof node.text === "string" && node.text.trim().length > 0) return true;
      return (node.content ?? []).some((child) => visit(child as typeof node));
    };
    return visit(json);
  } catch {
    return false;
  }
}

/** `message` guarda o JSON do Tiptap serializado como string (`JSON.stringify`) — mesmo
 * editor de texto rico usado em `/admin/posts`. */
export const createTicketSchema = z.object({
  subject: z.string().min(3).max(255),
  category: z.enum(TICKET_CATEGORIES),
  message: z.string().min(1).max(20000).refine(hasTiptapContent, "Escreva uma mensagem."),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const ticketMessageSchema = z.object({
  message: z.string().min(1).max(2000),
});

export type TicketMessageInput = z.infer<typeof ticketMessageSchema>;

export const TICKET_STATUSES = ["open", "answered", "closed"] as const;
