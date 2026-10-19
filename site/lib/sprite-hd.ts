/**
 * HD Mode das sprites (mesmo recurso do cliente — `hdSprites`, xBRZ 2x, ver `lib/xbrz/xbrz.ts`).
 *
 * As sprites continuam gravadas em 32px em `public/storage/...`; com o HD ligado as URLs passam
 * por `GET /api/sprites/hd/<mesmo caminho>`, que gera a versão 2x sob demanda e guarda em cache
 * em `public/storage/hd/...`. Módulo sem dependências de Node — é importado pelos helpers de URL
 * usados em client components.
 *
 * Regra de coordenadas (igual ao cliente, `spriteSize()` vs `getOffsetFactor()`): o tamanho em
 * pixels de uma sprite HD é `HD_SPRITE_SCALE`× o original; âncoras/offsets autorados em 32px
 * continuam em unidades de 32 — quem compõe sprites num canvas divide o tamanho natural da
 * imagem HD por `spriteScale(hd)` pra obter o tamanho lógico.
 */

export const HD_SPRITE_SCALE = 2;

export const HD_SPRITES_SETTINGS_URL = "/api/public/sprite-settings";

/** Tipos de `EntityImage` que são sprite (o `post` é capa de notícia, não sprite). */
const HD_ENTITY_IMAGE_TYPES = ["item", "monster", "spell", "vocation", "extoutfit"] as const;

export function isHdEntityImageType(entityType: string): boolean {
  return (HD_ENTITY_IMAGE_TYPES as readonly string[]).includes(entityType);
}

export function spriteScale(hd: boolean | undefined): number {
  return hd ? HD_SPRITE_SCALE : 1;
}

/** `relativePath` relativo a `public/storage` (sem barra inicial, sem query). */
export function storageSpriteUrl(relativePath: string, hd: boolean | undefined): string {
  return hd ? `/api/sprites/hd/${relativePath}` : `/storage/${relativePath}`;
}

/** Caminhos aceitos pela rota de HD — lista branca (também impede `..`/caminhos arbitrários). */
const HD_PATH_PATTERNS = [
  /^looktypes\/\d+\/\d+\.png$/,
  /^looktypes\/\d+\/\d+\/\d+\/(base|mask)\/\d+\.png$/,
  new RegExp(`^(${HD_ENTITY_IMAGE_TYPES.join("|")})\\/\\d+\\.png$`),
];

export function isHdSpritePath(relativePath: string): boolean {
  return HD_PATH_PATTERNS.some((pattern) => pattern.test(relativePath));
}

/** Máscara de cor de outfit: o cliente amplia com nearest-neighbour em vez de xBRZ
 * (`thingtype.cpp`, `getSpriteImage(id, nearest)`) — o xBRZ misturaria as cores das regiões
 * (amarelo/vermelho/verde/azul) e quebraria a recoloração. */
export function isMaskSpritePath(relativePath: string): boolean {
  return relativePath.includes("/mask/");
}

/** Fator real de uma URL de sprite já montada — 1 quando o helper caiu no arquivo original
 * (GIF, capa de post, HD desligado). */
export function spriteUrlScale(url: string | null | undefined): number {
  return url?.startsWith("/api/sprites/hd/") ? HD_SPRITE_SCALE : 1;
}
