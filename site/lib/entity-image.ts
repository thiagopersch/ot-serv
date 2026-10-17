import path from "node:path";

/**
 * Tipos de entidade que podem ter imagem custom no portal (independente do sprite do cliente
 * OTServer, que vive só no `.otb`, fora do escopo do items.xml/movements.xml).
 */
export const ENTITY_IMAGE_TYPES = ["item", "monster", "spell", "vocation", "post", "extoutfit"] as const;
export type EntityImageType = (typeof ENTITY_IMAGE_TYPES)[number];

export function isEntityImageType(value: string): value is EntityImageType {
  return (ENTITY_IMAGE_TYPES as readonly string[]).includes(value);
}

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/**
 * Arquivo fica em `public/storage/{entityType}/{entityId}.{extensão}`, servido estaticamente
 * pelo Next (zero rota de streaming). Atenção: `output: "standalone"` (next.config.ts) copia
 * `public/` no momento do build — uploads gravados em runtime não entram nesse snapshot
 * automaticamente (mesma limitação pré-existente de `public/downloads/patches`, ver AGENTS.md).
 * Em produção via Docker, `public/storage` precisa ser um volume persistente compartilhado
 * entre o container e o `public/` servido, não algo a "corrigir" aqui.
 */
export function entityImageStoragePath(entityType: EntityImageType, entityId: number, extension: string): string {
  return path.join(process.cwd(), "public", "storage", entityType, `${entityId}.${extension}`);
}

export function entityImageUrl(
  entityType: EntityImageType,
  entityId: number,
  extension: string,
  updatedAt: Date
): string {
  return `/storage/${entityType}/${entityId}.${extension}?v=${updatedAt.getTime()}`;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const GIF_SIGNATURE_PREFIX = [0x47, 0x49, 0x46, 0x38]; // "GIF8"

/** Nunca confiar em nome de arquivo/mime-type informado pelo cliente — sempre farejar os
 * bytes reais (um atacante pode renomear qualquer arquivo para .png). */
export function detectImageExtension(buffer: Buffer): "png" | "gif" | null {
  if (buffer.length >= 8 && PNG_SIGNATURE.every((byte, index) => buffer[index] === byte)) {
    return "png";
  }

  if (
    buffer.length >= 6 &&
    GIF_SIGNATURE_PREFIX.every((byte, index) => buffer[index] === byte) &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) && // '7' ou '9' (GIF87a / GIF89a)
    buffer[5] === 0x61 // 'a'
  ) {
    return "gif";
  }

  return null;
}
