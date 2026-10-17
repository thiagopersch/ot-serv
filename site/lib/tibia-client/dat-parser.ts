/**
 * Parser do `Tibia.dat` (catálogo de things do cliente Tibia 8.60: items, outfits, effects e
 * missiles/distance effects). Formato confirmado por pesquisa do binário 8.6 (ver plano da
 * feature de import):
 *
 * Header: `u32 signature`, `u16 itemCount, u16 outfitCount, u16 effectCount, u16 distanceCount`
 * (todos u16 em 8.6 — só viraram u32 em versões bem posteriores). Items recebem IDs sequenciais
 * de 100 até `100+itemCount-1` (convenção: os primeiros 99 IDs não existem no `.dat`); outfits,
 * effects e missiles têm cada um seu próprio contador independente, de 1 até `count`. Ordem de
 * leitura no arquivo: Items → Outfits → Effects → Missiles.
 *
 * Por thing: bloco de atributos (opcodes lidos em loop até o terminador `0xFF`, cada opcode com
 * 0+ bytes de payload — mesma família de opcodes usada em `FLAG_EXTRA_BYTES` de
 * `lib/obd/obd-parser.ts`), seguido do bloco de sprite:
 * `u8 width, u8 height, [u8 exactSize se width>1||height>1], u8 layers, u8 patternX, u8 patternY,
 * u8 patternZ, u8 frames`, e então a lista de `spriteIds` (`u16` cada num cliente 8.6 "puro", ou
 * `u32` quando `extended: true` no `.otfi` — confirmado empiricamente contra o cliente real deste
 * projeto, que É extended apesar de estar na pasta `860`; ver `otfi-parser.ts`). Em 8.6 NÃO existe
 * bloco de "frame group"/duração por frame depois de `frames` (isso só foi introduzido em
 * clientes ~10.50+) — os spriteIds vêm direto na sequência.
 *
 * A ordem em que os `spriteIds` aparecem no arquivo (mais externo → mais interno: frame →
 * patternZ → patternY → patternX → layer → height → width) é a MESMA ordem usada pela fórmula
 * `getObdSpriteIndex` de `lib/obd/obd-parser.ts` — por isso dá pra montar um `sprites: Buffer[]`
 * a partir do `.dat`+`.spr` e reaproveitar `renderLooktypeFrames`/`composeFrame` de
 * `lib/obd/obd-render.ts` sem nenhuma alteração (ver `lib/tibia-client/dat-to-obd-adapter.ts`).
 */
import { ByteReader } from "@/lib/tibia-client/byte-reader";
import { DEFAULT_TIBIA_CLIENT_FORMAT, type TibiaClientFormat } from "@/lib/tibia-client/otfi-parser";

export type TibiaDatCategory = "item" | "outfit" | "effect" | "missile";

export type TibiaDatThing = {
  id: number;
  category: TibiaDatCategory;
  width: number;
  height: number;
  layers: number;
  patternX: number;
  patternY: number;
  patternZ: number;
  frames: number;
  spriteIds: number[];
  /** Só para diagnóstico (ver script de validação) — velocidade do opcode Ground (0x00), quando
   * presente. Não é usado pela renderização. */
  groundSpeed?: number;
};

export type TibiaDatParseResult = {
  signature: number;
  items: TibiaDatThing[];
  outfits: TibiaDatThing[];
  effects: TibiaDatThing[];
  missiles: TibiaDatThing[];
  /** Avisos não-fatais (ex.: contador do header maior que a quantidade real de things de uma
   * categoria) — não impedem o import, mas vale registrar/mostrar ao admin. */
  warnings: string[];
};

export class DatParseError extends Error {
  constructor(
    message: string,
    readonly context: { category: TibiaDatCategory; id: number; offset: number }
  ) {
    super(`${message} (categoria=${context.category}, id=${context.id}, offset=${context.offset})`);
  }
}

const FIRST_ITEM_ID = 100;

/**
 * Opcodes de atributo com payload extra (bytes além do próprio opcode) — tabela extraída
 * diretamente do enum `DatFlags` em `server/RME/source/client_version.h` (linhas 136-180) e da
 * lógica de leitura em `server/RME/source/graphics.cpp::loadSpriteMetadataFlags` — o RME incluído
 * neste repositório já lê corretamente este mesmo `.dat`, então é a referência autoritativa (mais
 * confiável que pesquisa genérica sobre "clientes 8.x", que se mostrou desalinhada em alguns
 * pontos ao validar contra o arquivo real — ver histórico de tentativas no script de debug).
 * Numeração sem deslocamento (faixa `dat_format` 8.6-9.86 no RME, sem os "+1" aplicados só a
 * partir de 10.10+). Qualquer opcode fora desta tabela (e fora de `ATTRIBUTE_GROUND`/
 * `MARKET_ITEM_FLAG`/`ATTRIBUTE_END`) é tratado como payload de 0 bytes — mesma lista de flags
 * booleanas sem payload do RME (GroundBorder, OnBottom, Container, Stackable, ForceUse, MultiUse,
 * FluidContainer, Splash, NotWalkable, NotMoveable, BlockProjectile, NotPathable, Pickupable,
 * Hangable, HookSouth, HookEast, Rotateable, DontHide, Translucent, LyingCorpse, AnimateAlways,
 * FullGround, Look, Wrappable, Unwrappable, TopEffect, FloorChange, NoMoveAnimation, Chargeable).
 */
const ATTRIBUTE_EXTRA_BYTES: Record<number, number> = {
  0x08: 2, // Writable (maxTextLength: u16)
  0x09: 2, // WritableOnce (maxTextLength: u16)
  0x15: 4, // Light (intensity + color: 2x u16)
  0x18: 4, // Displacement (offsetX + offsetY: 2x u16)
  0x19: 2, // Elevation (drawHeight: u16)
  0x1c: 2, // MinimapColor (u16)
  0x1d: 2, // LensHelp (u16)
  0x20: 2, // Cloth (slot: u16)
  0x22: 2, // Usable (u16) — presente na tabela do RME, ausente da pesquisa genérica inicial
};
const ATTRIBUTE_GROUND = 0x00; // payload: u16 speed — capturado separadamente para diagnóstico
/** Atributo de tamanho variável — `file.skip(6)` (marketCategory+tradeAs+showAs, 3x u16) + string
 * (u16 length + bytes) + `file.skip(4)` (restrictProfession+restrictLevel, 2x u16), igual a
 * `graphics.cpp` linhas 693-699. Opcode 0x21 (=33=`DatFlagMarket`) — NÃO o mesmo valor usado por
 * `MARKET_ITEM_FLAG` em `lib/obd/obd-parser.ts` (0x22): o `.obd` é um formato próprio do Object
 * Builder com sua própria numeração interna, não a numeração nativa do `.dat` usada aqui. */
const MARKET_ITEM_FLAG = 0x21;
const ATTRIBUTE_END = 0xff;

/** Teto de sanidade para nº de sprites de UM thing — qualquer coisa acima disso é sinal quase
 * certo de que o cursor desalinhou no bloco de atributos anterior (ex.: payload de tamanho
 * errado para algum opcode). */
const MAX_SPRITES_PER_THING = 10_000;

function readAttributes(reader: ByteReader, ctx: { category: TibiaDatCategory; id: number }): { groundSpeed?: number } {
  let groundSpeed: number | undefined;

  while (true) {
    if (reader.remaining() <= 0) {
      throw new DatParseError("Fim inesperado do arquivo dentro do bloco de atributos.", {
        ...ctx,
        offset: reader.position,
      });
    }

    const opcode = reader.u8();
    if (opcode === ATTRIBUTE_END) break;

    if (opcode === ATTRIBUTE_GROUND) {
      groundSpeed = reader.u16();
      continue;
    }

    if (opcode === MARKET_ITEM_FLAG) {
      reader.u16(); // marketCategory
      reader.u16(); // marketTradeAs
      reader.u16(); // marketShowAs
      const nameLength = reader.u16();
      reader.bytes(nameLength); // marketName (iso-8859-1, 1 byte/char)
      reader.u16(); // marketRestrictProfession
      reader.u16(); // marketRestrictLevel
      continue;
    }

    const extraBytes = ATTRIBUTE_EXTRA_BYTES[opcode];
    if (extraBytes) reader.bytes(extraBytes);
  }

  return { groundSpeed };
}

function readThing(
  reader: ByteReader,
  category: TibiaDatCategory,
  id: number,
  format: TibiaClientFormat
): TibiaDatThing {
  const ctx = { category, id };
  const { groundSpeed } = readAttributes(reader, ctx);

  if (reader.remaining() < 6) {
    throw new DatParseError("Fim inesperado do arquivo no bloco de sprite (width/height/...).", {
      ...ctx,
      offset: reader.position,
    });
  }

  const width = reader.u8();
  const height = reader.u8();
  if (width > 1 || height > 1) reader.u8(); // exactSize — não usado para composição

  const layers = reader.u8();
  const patternX = reader.u8();
  const patternY = reader.u8();
  const patternZ = reader.u8();
  const frames = reader.u8();

  const totalSprites = width * height * layers * patternX * patternY * patternZ * frames;
  const spriteIdBytes = format.extended ? 4 : 2;
  if (totalSprites <= 0 || totalSprites > MAX_SPRITES_PER_THING) {
    throw new DatParseError(
      `Quantidade de sprites implausível (${totalSprites}) — sinal de desalinhamento do cursor no bloco de atributos anterior.`,
      { ...ctx, offset: reader.position }
    );
  }
  if (reader.remaining() < totalSprites * spriteIdBytes) {
    throw new DatParseError(
      `Faltam bytes no arquivo para os ${totalSprites} spriteIds esperados (restam ${reader.remaining()}).`,
      { ...ctx, offset: reader.position }
    );
  }

  const spriteIds: number[] = new Array(totalSprites);
  for (let i = 0; i < totalSprites; i++) spriteIds[i] = format.extended ? reader.u32() : reader.u16();

  return { id, category, width, height, layers, patternX, patternY, patternZ, frames, spriteIds, groundSpeed };
}

function readCategory(
  reader: ByteReader,
  category: TibiaDatCategory,
  firstId: number,
  count: number,
  format: TibiaClientFormat,
  warnings: string[]
): TibiaDatThing[] {
  const things: TibiaDatThing[] = [];
  for (let i = 0; i < count; i++) {
    // Contadores do header (`itemCount`/`outfitCount`/...) às vezes ficam desatualizados em
    // relação ao conteúdo real (ex.: edição manual do `.dat` sem recalcular o header) — atingir o
    // fim exato do arquivo bem na fronteira de um thing (não no meio de um) não é corrupção, é só
    // o contador declarado sendo maior que o que de fato existe. Trata como fim benigno da
    // categoria (loga aviso) em vez de abortar o import inteiro.
    if (reader.remaining() === 0) {
      warnings.push(
        `Categoria ${category}: header declara ${count} thing(s), mas o arquivo termina após ${i} — contador provavelmente desatualizado.`
      );
      break;
    }
    things.push(readThing(reader, category, firstId + i, format));
  }
  return things;
}

/** Outfits "de verdade" quase sempre têm `patternX = 4` (as 4 direções N/E/S/O de um personagem)
 * — é a assinatura estrutural mais confiável pra distinguir outfit de effect (que tem
 * `patternX = 1`, não tem direção). */
const OUTFIT_PATTERN_X = 4;

/** Não reclassifica mais que essa fração do total de outfits — se o "bloco final sem
 * patternX=4" for grande demais, é mais seguro assumir que a heurística não se aplica a este
 * arquivo (ex.: um `.dat` onde outfits legitimamente variam de patternX por algum motivo) do que
 * arriscar mover coisas que são outfits de verdade para a categoria errada. */
const MAX_RECLASSIFIED_FRACTION = 0.2;

/**
 * Corrige uma inconsistência observada empiricamente em pelo menos um `.dat` customizado deste
 * projeto: o `outfitCount` do header é lido corretamente (não é um bug de parsing binário), mas
 * o valor gravado no arquivo inclui alguns things no final que o Object Builder trata como
 * **effect**, não outfit — deslocando a numeração de todos os effects seguintes (ex.: um effect
 * que no Object Builder é o #880 foi importado como effect_781, um offset de exatamente 99 —
 * igual à quantidade de things reclassificados aqui).
 *
 * Não existe um campo separado no header pra indicar essa fronteira "verdadeira" (o formato só
 * tem os 4 `u16` documentados no topo do arquivo) — a correção é uma heurística estrutural pós-
 * leitura: varre `outfits` do fim para o começo até achar o último thing com `patternX===4`
 * (outfit de verdade); tudo depois disso (patternX !== 4 de forma contígua até o fim do array,
 * incluindo eventuais slots vazios/placeholder) é devolvido separadamente para ser prepended à
 * lista de effects por quem chama, generalizando para qualquer `.dat` customizado com o mesmo
 * tipo de inconsistência (não é um valor "99" hardcoded).
 */
function splitMisclassifiedTrailingEffects(outfits: TibiaDatThing[]): {
  outfits: TibiaDatThing[];
  misclassifiedAsEffect: TibiaDatThing[];
} {
  let lastRealOutfitIndex = outfits.length - 1;
  while (lastRealOutfitIndex >= 0 && outfits[lastRealOutfitIndex].patternX !== OUTFIT_PATTERN_X) {
    lastRealOutfitIndex--;
  }

  const trailingCount = outfits.length - 1 - lastRealOutfitIndex;
  if (trailingCount <= 0 || trailingCount > outfits.length * MAX_RECLASSIFIED_FRACTION) {
    return { outfits, misclassifiedAsEffect: [] };
  }

  return {
    outfits: outfits.slice(0, lastRealOutfitIndex + 1),
    misclassifiedAsEffect: outfits.slice(lastRealOutfitIndex + 1).map((thing) => ({ ...thing, category: "effect" as const })),
  };
}

export function parseDat(buffer: Buffer, format: TibiaClientFormat = DEFAULT_TIBIA_CLIENT_FORMAT): TibiaDatParseResult {
  const reader = new ByteReader(buffer);

  if (reader.remaining() < 12) {
    throw new DatParseError("Arquivo .dat menor que o header esperado.", {
      category: "item",
      id: -1,
      offset: 0,
    });
  }

  const signature = reader.u32();
  const itemCount = reader.u16();
  const outfitCount = reader.u16();
  const effectCount = reader.u16();
  const distanceCount = reader.u16();

  const warnings: string[] = [];
  const items = readCategory(reader, "item", FIRST_ITEM_ID, itemCount, format, warnings);
  const rawOutfits = readCategory(reader, "outfit", 1, outfitCount, format, warnings);
  const rawEffects = readCategory(reader, "effect", 1, effectCount, format, warnings);
  const missiles = readCategory(reader, "missile", 1, distanceCount, format, warnings);

  const { outfits: outfitsFixed, misclassifiedAsEffect } = splitMisclassifiedTrailingEffects(rawOutfits);
  if (misclassifiedAsEffect.length > 0) {
    warnings.push(
      `${misclassifiedAsEffect.length} thing(s) no final da seção de outfits foram reclassificados como effects ` +
        `(patternX indicava effect, não outfit) — outfitCount do header provavelmente inclui coisas que o ` +
        `Object Builder trata como effect.`
    );
  }

  // Reclassificados vão pro INÍCIO dos effects (ocupam essa posição no arquivo bruto, antes da
  // seção que antes chamávamos de "effect") e todo o array combinado é renumerado sequencialmente
  // — preserva a ordem relativa e faz a numeração bater com o Object Builder.
  const effectsFixed = [...misclassifiedAsEffect, ...rawEffects].map((thing, index) => ({
    ...thing,
    id: index + 1,
  }));

  return { signature, items, outfits: outfitsFixed, effects: effectsFixed, missiles, warnings };
}
