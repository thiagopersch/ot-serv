import path from "node:path";

/**
 * Mídia embutida no conteúdo do editor rico (Tiptap) de um Post — diferente de
 * `EntityImage` (uma imagem de capa por entidade): um post pode ter N arquivos de mídia
 * espalhados pelo texto, cada um com nome próprio, então usamos `randomUUID()` no arquivo.
 */
export const POST_MEDIA_KINDS = ["image", "video", "audio"] as const;
export type PostMediaKind = (typeof POST_MEDIA_KINDS)[number];

export const MAX_POST_MEDIA_BYTES = 25 * 1024 * 1024;

export function postMediaStorageDir(postId: number): string {
  return path.join(process.cwd(), "public", "storage", "post-media", String(postId));
}

export function postMediaUrl(postId: number, filename: string): string {
  return `/storage/post-media/${postId}/${filename}`;
}

type DetectedMedia = { kind: PostMediaKind; extension: string };

/** Nunca confia em nome/mime informado pelo cliente — fareja os bytes reais. */
export function detectPostMedia(buffer: Buffer): DetectedMedia | null {
  if (buffer.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => buffer[i] === b)) {
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
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WAVE"
  ) {
    return { kind: "audio", extension: "wav" };
  }
  if (buffer.length >= 3 && buffer.toString("ascii", 0, 3) === "ID3") {
    return { kind: "audio", extension: "mp3" };
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
    return { kind: "audio", extension: "mp3" };
  }
  if (buffer.length >= 4 && buffer.toString("ascii", 0, 4) === "OggS") {
    return { kind: "audio", extension: "ogg" };
  }
  if (buffer.length >= 4 && [0x1a, 0x45, 0xdf, 0xa3].every((b, i) => buffer[i] === b)) {
    return { kind: "video", extension: "webm" };
  }
  if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp") {
    return { kind: "video", extension: "mp4" };
  }
  return null;
}
