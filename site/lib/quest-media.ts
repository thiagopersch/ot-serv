import path from "node:path";

/**
 * Imagem de capa de uma Quest (`/admin/quests`) — só para exibição web (character-profile,
 * admin). A imagem exibida dentro do jogo continua vindo de
 * `modules/game_questlog/imgs/<nome-da-quest>.png` no cliente, sem relação com este arquivo.
 */
export const MAX_QUEST_IMAGE_BYTES = 5 * 1024 * 1024;

export function questMediaStorageDir(questId: number): string {
  return path.join(process.cwd(), "public", "storage", "quest-media", String(questId));
}

export function questMediaUrl(questId: number, filename: string): string {
  return `/storage/quest-media/${questId}/${filename}`;
}

type DetectedImage = { extension: string };

/** Nunca confia em nome/mime informado pelo cliente — fareja os bytes reais. */
export function detectQuestImage(buffer: Buffer): DetectedImage | null {
  if (
    buffer.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => buffer[i] === b)
  ) {
    return { extension: "png" };
  }
  if (
    buffer.length >= 6 &&
    [0x47, 0x49, 0x46, 0x38].every((b, i) => buffer[i] === b) &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return { extension: "gif" };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extension: "jpg" };
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { extension: "webp" };
  }
  return null;
}
