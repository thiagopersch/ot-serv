
/**
 * Parser do formato `.obd` do Object Builder (https://github.com/ottools/ObjectBuilder).
 * Layout binário e nomes de flags extraídos diretamente do `OBDEncoder.as` original (branch
 * `decode`/`decodeV2`) — validado byte a byte contra arquivos `.obd` reais exportados pela
 * ferramenta (ver `C:\Users\thiag\Projetos\Utils\sprites`), tanto para category=item quanto
 * category=outfit multi-tile.
 *
 * Só a variante OBD_VERSION_2 (=200) é suportada — é o formato emitido por qualquer versão
 * atual do Object Builder. OBD_VERSION_1 (cliques `clientVersion` nos 2 primeiros bytes, sem
 * o campo de versão do formato) é de builds muito antigos da ferramenta e não é gerado mais.
 *
 * Compressão: o arquivo inteiro é um stream LZMA_ALONE padrão (5 bytes de propriedades + 8
 * bytes de tamanho descomprimido, little-endian) — mesmo formato que `lzma -F alone`/Python
 * `lzma.decompress(..., format=FORMAT_ALONE)`, apesar de vir de `ByteArray.compress(LZMA)` do
 * Flash. Nenhuma variante Adobe/não-padrão encontrada na prática.
 */

import { ByteReader } from "@/lib/tibia-client/byte-reader";

const OBD_VERSION_2 = 200;

const CATEGORY_BY_VALUE = ["", "item", "outfit", "effect", "missile"] as const;
export type ObdCategory = (typeof CATEGORY_BY_VALUE)[number];

/** Tamanho (em bytes) dos argumentos extras de cada flag de propriedade, espelhando
 * `OBDEncoder.writeProperties`/`readProperties` — só precisamos avançar o cursor de leitura
 * corretamente, os valores em si (stackable, container, etc.) não importam pra composição
 * visual do sprite. */
const FLAG_EXTRA_BYTES: Record<number, number> = {
  0x00: 2, // GROUND (groundSpeed: uint16)
  0x08: 2, // WRITABLE (maxTextLength: uint16)
  0x09: 2, // WRITABLE_ONCE
  0x16: 4, // HAS_LIGHT (lightLevel + lightColor: 2x uint16)
  0x19: 4, // HAS_OFFSET (offsetX + offsetY: 2x uint16)
  0x1a: 2, // HAS_ELEVATION (elevation: uint16)
  0x1d: 2, // MINI_MAP (miniMapColor: uint16)
  0x1e: 2, // LENS_HELP (lensHelp: uint16)
  0x21: 2, // CLOTH (clothSlot: uint16)
  0x23: 2, // DEFAULT_ACTION (defaultAction: uint16)
};
const MARKET_ITEM_FLAG = 0x22;
const LAST_FLAG = 0xff;

export type ObdFrameDuration = { minimum: number; maximum: number };

export type ObdThingData = {
  clientVersion: number;
  category: ObdCategory;
  width: number;
  height: number;
  layers: number;
  patternX: number;
  patternY: number;
  patternZ: number;
  frames: number;
  frameDurations: ObdFrameDuration[];
  /** Índice flat = `getSpriteIndex` do ObjectBuilder — ver `getObdSpriteIndex` abaixo. */
  sprites: Buffer[];
};

function skipProperties(reader: ByteReader): void {
  while (true) {
    const flag = reader.u8();
    if (flag === LAST_FLAG) return;

    if (flag === MARKET_ITEM_FLAG) {
      reader.u16(); // marketCategory
      reader.u16(); // marketTradeAs
      reader.u16(); // marketShowAs
      const nameLength = reader.u16();
      reader.bytes(nameLength); // marketName (iso-8859-1, 1 byte/char)
      reader.u16(); // marketRestrictProfession
      reader.u16(); // marketRestrictLevel
      continue;
    }

    const extraBytes = FLAG_EXTRA_BYTES[flag];
    if (extraBytes) reader.bytes(extraBytes);
  }
}

/** Mesma fórmula de `ThingType.getSpriteIndex` do ObjectBuilder — usada pra localizar o
 * sprite certo dado (layer, direção/pattern, frame) na lista flat decodificada. */
export function getObdSpriteIndex(
  thing: ObdThingData,
  { width, height, layer, patternX, patternY, patternZ, frame }: {
    width: number;
    height: number;
    layer: number;
    patternX: number;
    patternY: number;
    patternZ: number;
    frame: number;
  }
): number {
  const index =
    ((((((frame % thing.frames) * thing.patternZ + patternZ) * thing.patternY + patternY) *
      thing.patternX +
      patternX) *
      thing.layers +
      layer) *
      thing.height +
      height) *
      thing.width +
    width;
  return index;
}

export class ObdParseError extends Error {}

export async function parseObd(fileBuffer: Buffer): Promise<ObdThingData> {
  const { decompress } = await import("lzma1");

  let raw: Buffer;
  try {
    raw = Buffer.from(decompress(new Uint8Array(fileBuffer)));
  } catch {
    throw new ObdParseError("Não foi possível descomprimir o arquivo OBD (LZMA inválido).");
  }

  const reader = new ByteReader(raw);
  const obdVersion = reader.u16();
  if (obdVersion !== OBD_VERSION_2) {
    throw new ObdParseError(
      `Versão OBD ${obdVersion} não suportada — exporte novamente com uma versão atual do Object Builder (formato v2).`
    );
  }

  const clientVersion = reader.u16();
  const categoryValue = reader.u8();
  const category = CATEGORY_BY_VALUE[categoryValue];
  if (!category) {
    throw new ObdParseError(`Categoria OBD desconhecida (${categoryValue}).`);
  }

  reader.u32(); // posição dos sprites (redundante — só usada pelo editor pra seek rápido)

  skipProperties(reader);

  const width = reader.u8();
  const height = reader.u8();
  if (width > 1 || height > 1) reader.u8(); // exactSize (não usado pra composição)

  const layers = reader.u8();
  const patternX = reader.u8();
  const patternY = reader.u8();
  const patternZ = reader.u8();
  const frames = reader.u8();

  const frameDurations: ObdFrameDuration[] = [];
  if (frames > 1) {
    reader.u8(); // animationMode
    reader.i32(); // loopCount
    reader.i8(); // startFrame
    for (let i = 0; i < frames; i++) {
      const minimum = reader.u32();
      const maximum = reader.u32();
      frameDurations.push({ minimum, maximum });
    }
  }

  const totalSprites = width * height * layers * patternX * patternY * patternZ * frames;
  if (totalSprites > 4096) {
    throw new ObdParseError("O arquivo OBD tem mais de 4096 sprites — fora do esperado.");
  }

  const sprites: Buffer[] = [];
  for (let i = 0; i < totalSprites; i++) {
    reader.u32(); // spriteId (id no .spr original — irrelevante aqui, sprites já vêm embutidos)
    sprites.push(reader.bytes(4096));
  }

  return {
    clientVersion,
    category,
    width,
    height,
    layers,
    patternX,
    patternY,
    patternZ,
    frames,
    frameDurations,
    sprites,
  };
}
