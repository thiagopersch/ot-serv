/**
 * Parser do `Tibia.spr` (sprite sheet do cliente Tibia). Formato validado empiricamente contra o
 * arquivo real do projeto (`cliente/data/things/860/Tibia.spr`, ~1.3GB, extended+transparency) e
 * cruzado com a implementação de referência em `server/RME/source/graphics.cpp`
 * (`GraphicManager::loadSpriteData`) — ver `dat-parser.ts` para o contexto completo e
 * `otfi-parser.ts` para as flags `extended`/`transparency` que mudam a forma binária abaixo:
 *
 * Header: `u32 signature`, `spriteCount` (`u32` se `extended`, senão `u16`).
 * Tabela de offsets: `spriteCount` entradas de `u32` (offset absoluto no arquivo; 0 = vazio).
 * Por sprite, no offset indicado: **3 bytes ignorados** (placeholder de color-key legado, sempre
 * presentes independente de `extended`/`transparency` — confirmado em `loadSpriteData`, onde a
 * leitura real começa em `offset + 3`), depois `u16 colorDataSize`, depois uma sequência de
 * chunks RLE somando exatamente `colorDataSize` bytes: `u16 transparentPixelCount,
 * u16 coloredPixelCount`, seguido de `coloredPixelCount` pixels de **4 bytes (R,G,B,A)** se
 * `transparency` estiver ativo, ou 3 bytes (R,G,B, alpha implícito 255) caso contrário. O total de
 * pixels decodificado pode ficar abaixo de 1024 (32x32) — pixels finais não codificados ficam
 * implicitamente transparentes (o buffer de saída já nasce zerado).
 */
import { ByteReader } from "@/lib/tibia-client/byte-reader";
import { DEFAULT_TIBIA_CLIENT_FORMAT, type TibiaClientFormat } from "@/lib/tibia-client/otfi-parser";

export const SPRITE_PIXELS = 32 * 32;
/** Tamanho de um sprite já decodificado em ARGB (1 byte alpha + 3 bytes cor por pixel) — mesmo
 * layout que `lib/obd/obd-parser.ts` produz para os sprites de um `.obd`, consumido sem alteração
 * por `argbToRgba`/`composeFrame` em `lib/obd/obd-render.ts`. */
export const SPRITE_ARGB_BYTES = SPRITE_PIXELS * 4;

/** Bytes ignorados no início de cada bloco de sprite (placeholder de color-key legado) antes do
 * campo `colorDataSize` — constante independente de `extended`/`transparency` (ver cabeçalho do
 * arquivo). */
const SPRITE_HEADER_SKIP_BYTES = 3;

export class SprParseError extends Error {}

/** Sprite vazio (spriteId 0 ou offset 0) — totalmente transparente. Compartilhado (não realocado
 * por chamada) porque nunca é mutado pelos consumidores (`argbToRgba` só lê). */
const EMPTY_SPRITE_ARGB = Buffer.alloc(SPRITE_ARGB_BYTES);

export class TibiaSprReader {
  private readonly cache = new Map<number, Buffer>();

  private constructor(
    private readonly buffer: Buffer,
    private readonly format: TibiaClientFormat,
    readonly signature: number,
    readonly spriteCount: number,
    private readonly offsetTableStart: number
  ) {}

  static open(buffer: Buffer, format: TibiaClientFormat = DEFAULT_TIBIA_CLIENT_FORMAT): TibiaSprReader {
    const minHeaderBytes = format.extended ? 8 : 6;
    if (buffer.length < minHeaderBytes) {
      throw new SprParseError("Arquivo .spr menor que o header esperado.");
    }

    const reader = new ByteReader(buffer);
    const signature = reader.u32();
    const spriteCount = format.extended ? reader.u32() : reader.u16();

    const offsetTableStart = reader.position;
    const offsetTableBytes = spriteCount * 4;
    if (buffer.length < offsetTableStart + offsetTableBytes) {
      throw new SprParseError(
        `Tabela de offsets incompleta: esperava ${offsetTableBytes} bytes para ${spriteCount} sprites, arquivo tem só ${buffer.length - offsetTableStart} restantes.`
      );
    }

    return new TibiaSprReader(buffer, format, signature, spriteCount, offsetTableStart);
  }

  private readOffset(spriteId: number): number {
    // Sprite ID 0 nunca é usado (IDs válidos vão de 1 a spriteCount) — tratado à parte em
    // `getSpriteArgb`, não deveria chegar aqui.
    const entryPosition = this.offsetTableStart + (spriteId - 1) * 4;
    return this.buffer.readUInt32LE(entryPosition);
  }

  /**
   * Decodifica (com cache) o sprite `spriteId` para um buffer ARGB de `SPRITE_ARGB_BYTES` bytes.
   * `spriteId` fora do intervalo `[1, spriteCount]` ou com offset 0 retorna um sprite vazio
   * (transparente) em vez de lançar — sprites "buracos" são esperados no formato (ex.: slots
   * reservados nunca usados por nenhum thing).
   */
  getSpriteArgb(spriteId: number): Buffer {
    if (spriteId <= 0 || spriteId > this.spriteCount) return EMPTY_SPRITE_ARGB;

    const cached = this.cache.get(spriteId);
    if (cached) return cached;

    const offset = this.readOffset(spriteId);
    if (offset === 0 || offset >= this.buffer.length) return EMPTY_SPRITE_ARGB;

    const decoded = this.decodeSpriteAt(offset, spriteId);
    this.cache.set(spriteId, decoded);
    return decoded;
  }

  private decodeSpriteAt(offset: number, spriteId: number): Buffer {
    const sizeFieldPos = offset + SPRITE_HEADER_SKIP_BYTES;
    if (sizeFieldPos + 2 > this.buffer.length) {
      throw new SprParseError(`Sprite #${spriteId}: offset ${offset} fora do arquivo.`);
    }

    const colorDataSize = this.buffer.readUInt16LE(sizeFieldPos);
    const dataStart = sizeFieldPos + 2;
    const dataEnd = dataStart + colorDataSize;
    if (dataEnd > this.buffer.length) {
      throw new SprParseError(
        `Sprite #${spriteId}: colorDataSize (${colorDataSize}) ultrapassa o fim do arquivo.`
      );
    }

    const pixelBytes = this.format.transparency ? 4 : 3;
    const argb = Buffer.alloc(SPRITE_ARGB_BYTES);
    let readPos = dataStart;
    let pixelIndex = 0;

    // Decodifica até esgotar exatamente `colorDataSize` bytes — NÃO até preencher os 1024 pixels:
    // pixels finais não codificados no arquivo ficam transparentes por padrão (buffer já zerado).
    while (readPos < dataEnd) {
      if (readPos + 4 > dataEnd) {
        throw new SprParseError(`Sprite #${spriteId}: chunk RLE incompleto no offset ${readPos}.`);
      }

      const transparentPixelCount = this.buffer.readUInt16LE(readPos);
      const coloredPixelCount = this.buffer.readUInt16LE(readPos + 2);
      readPos += 4;

      pixelIndex += transparentPixelCount; // já ficam em alpha=0 (Buffer.alloc zera por padrão)

      const coloredBytes = coloredPixelCount * pixelBytes;
      if (readPos + coloredBytes > dataEnd) {
        throw new SprParseError(`Sprite #${spriteId}: dados de cor incompletos no offset ${readPos}.`);
      }

      for (let i = 0; i < coloredPixelCount && pixelIndex < SPRITE_PIXELS; i++) {
        const pixelOffset = pixelIndex * 4;
        argb[pixelOffset] = 255; // A (sobrescrito abaixo se `transparency` trouxer alpha explícito)
        argb[pixelOffset + 1] = this.buffer[readPos]; // R
        argb[pixelOffset + 2] = this.buffer[readPos + 1]; // G
        argb[pixelOffset + 3] = this.buffer[readPos + 2]; // B
        if (this.format.transparency) argb[pixelOffset] = this.buffer[readPos + 3]; // A explícito
        readPos += pixelBytes;
        pixelIndex += 1;
      }
    }

    return argb;
  }
}
