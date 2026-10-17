import path from "node:path";

/** Anexo (imagem/vídeo) de uma mensagem de ticket de suporte — mesmo padrão de
 * `lib/post-media.ts`, mas sem áudio (só imagem/vídeo, conforme pedido). */
export type TicketMediaKind = "image" | "video";

export const MAX_TICKET_MEDIA_BYTES = 25 * 1024 * 1024;

export function ticketMediaStorageDir(messageId: number): string {
  return path.join(process.cwd(), "public", "storage", "ticket-media", String(messageId));
}

export function ticketMediaUrl(messageId: number, filename: string): string {
  return `/storage/ticket-media/${messageId}/${filename}`;
}

type DetectedMedia = { kind: TicketMediaKind; extension: string };

/** Nunca confia em nome/mime informado pelo cliente — fareja os bytes reais. */
export function detectTicketMedia(buffer: Buffer): DetectedMedia | null {
  if (
    buffer.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => buffer[i] === b)
  ) {
    return { kind: "image", extension: "png" };
  }
  if (
    buffer.length >= 6 &&
    [0x47, 0x49, 0x46, 0x38].every((b, i) => buffer[i] === b) &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return { kind: "image", extension: "gif" };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { kind: "image", extension: "jpg" };
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { kind: "image", extension: "webp" };
  }
  if (buffer.length >= 4 && [0x1a, 0x45, 0xdf, 0xa3].every((b, i) => buffer[i] === b)) {
    return { kind: "video", extension: "webm" };
  }
  if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp") {
    return { kind: "video", extension: "mp4" };
  }
  return null;
}
