import { PNG } from "pngjs";

import { getObdSpriteIndex, type ObdThingData } from "@/lib/obd/obd-parser";

const SPRITE_SIZE = 32;

/** Direções na ordem usada pelo `.dat`/protocolo do Tibia (mesma da constante de direção de
 * movimento): 0=North, 1=East, 2=South, 3=West. Só relevante pra `category === "outfit"`. */
const SOUTH_DIRECTION_INDEX = 2;

/** Um sprite ARGB (4 bytes/pixel: A,R,G,B — formato do `BitmapData.getPixels/setPixels` do
 * Flash usado pelo Object Builder) vira RGBA (ordem que `pngjs` espera). */
function argbToRgba(argb: Buffer): Buffer {
  const rgba = Buffer.alloc(argb.length);
  for (let i = 0; i < argb.length; i += 4) {
    rgba[i] = argb[i + 1]; // R
    rgba[i + 1] = argb[i + 2]; // G
    rgba[i + 2] = argb[i + 3]; // B
    rgba[i + 3] = argb[i]; // A
  }
  return rgba;
}

/** Compõe (alpha-blend, "over") o pixel de origem sobre o destino — usado pra empilhar layers
 * (ex.: em items com `layers > 1`, a layer 0 costuma ser a base/moldura estática e as layers
 * seguintes o conteúdo que realmente anima, como o preenchimento de uma barra). */
function blendOver(dest: Buffer, destOffset: number, src: Buffer, srcOffset: number): void {
  const srcAlphaByte = src[srcOffset + 3];
  if (srcAlphaByte === 0) return;

  if (srcAlphaByte === 255) {
    dest[destOffset] = src[srcOffset];
    dest[destOffset + 1] = src[srcOffset + 1];
    dest[destOffset + 2] = src[srcOffset + 2];
    dest[destOffset + 3] = 255;
    return;
  }

  const srcAlpha = srcAlphaByte / 255;
  const destAlpha = dest[destOffset + 3] / 255;
  const outAlpha = srcAlpha + destAlpha * (1 - srcAlpha);

  for (let channel = 0; channel < 3; channel++) {
    const blended = src[srcOffset + channel] * srcAlpha + dest[destOffset + channel] * destAlpha * (1 - srcAlpha);
    dest[destOffset + channel] = outAlpha > 0 ? Math.round(blended / outAlpha) : 0;
  }
  dest[destOffset + 3] = Math.round(outAlpha * 255);
}

/** Monta um frame completo (todos os tiles de `width`x`height`, com as layers de `layers`
 * empilhadas nessa ordem) em um único buffer RGBA. Convenção do Tibia pra objetos multi-tile: o
 * tile (w=0,h=0) é o canto inferior-direito da imagem final — os demais se estendem pra cima
 * e pra esquerda a partir dele. */
function composeFrame(
  thing: ObdThingData,
  selection: { patternX: number; patternY: number; patternZ: number; frame: number },
  layers: number[]
): Buffer {
  const canvasWidth = thing.width * SPRITE_SIZE;
  const canvasHeight = thing.height * SPRITE_SIZE;
  const canvas = Buffer.alloc(canvasWidth * canvasHeight * 4);

  for (const layer of layers) {
    for (let h = 0; h < thing.height; h++) {
      for (let w = 0; w < thing.width; w++) {
        const index = getObdSpriteIndex(thing, { ...selection, layer, width: w, height: h });
        const sprite = thing.sprites[index];
        if (!sprite) continue;

        const rgba = argbToRgba(sprite);
        const destX = (thing.width - 1 - w) * SPRITE_SIZE;
        const destY = (thing.height - 1 - h) * SPRITE_SIZE;

        for (let y = 0; y < SPRITE_SIZE; y++) {
          for (let x = 0; x < SPRITE_SIZE; x++) {
            const srcOffset = (y * SPRITE_SIZE + x) * 4;
            const destOffset = ((destY + y) * canvasWidth + (destX + x)) * 4;
            blendOver(canvas, destOffset, rgba, srcOffset);
          }
        }
      }
    }
  }

  return canvas;
}

export type RenderedLooktypeFrame = { png: Buffer; durationMs: number };

const DEFAULT_FRAME_DURATION_MS = 100;

/** Teto absoluto de duração por quadro na pré-visualização/preview salvo (requisito do admin:
 * nenhum formato — .obd, .png único ou .gif animado — pode exibir um quadro por mais de 1s). */
export const MAX_FRAME_DURATION_MS = 1000;

/** Aplica o teto de `MAX_FRAME_DURATION_MS`, com fallback pro default quando a duração de origem
 * for inválida (0, negativa ou ausente). */
export function clampFrameDurationMs(durationMs: number | undefined | null): number {
  if (!durationMs || durationMs <= 0) return DEFAULT_FRAME_DURATION_MS;
  return Math.min(durationMs, MAX_FRAME_DURATION_MS);
}

function toPngBuffer(thing: ObdThingData, rgba: Buffer): Buffer {
  const png = new PNG({ width: thing.width * SPRITE_SIZE, height: thing.height * SPRITE_SIZE });
  rgba.copy(png.data);
  return PNG.sync.write(png);
}

/**
 * Renderiza as frames de animação de um `ThingData` já decodificado (ver `obd-parser.ts`):
 * - `outfit`: direção Sul parada (só layer 0, a sprite base — layer 1, quando existe, é a
 *   máscara de cor, não faz parte da pose "normal"; ver `renderOutfitDirectionalFrames` abaixo
 *   pra direção/cor de verdade), iterando `frames` (animação de andar) — pedido do usuário
 *   ("quando for outfit deve ser animado andando para o sul"); duração sempre fixada
 *   em 100ms por quadro (ver `DEFAULT_FRAME_DURATION_MS` abaixo) — ignora a duração declarada no
 *   OBD de propósito: alguns arquivos importados (ex.: moedas com patterns) declaram durações
 *   bem menores, o que fazia a pré-visualização/animação passar rápido demais.
 * - `item`/`effect`/`missile`: empilha todas as `layers` (quando `layers > 1` a layer 0 costuma
 *   ser a base/moldura estática e as seguintes o conteúdo que anima de fato — ex.: o
 *   preenchimento de uma barra) e percorre TODAS as combinações de `frames`×`patternX`×
 *   `patternY`×`patternZ` como quadros da animação — muitos itens (ex.: pilhas de moeda) usam
 *   patterns em vez de frames de verdade pra ter variações visuais, e o pedido do usuário é que
 *   isso também apareça animado, sempre a 100ms por quadro independente do arquivo ter frames
 *   de animação "de verdade" ou só patterns.
 */
/**
 * @param speedMs Velocidade (ms/quadro) escolhida pelo admin no upload/edição — sobrescreve o
 * `DEFAULT_FRAME_DURATION_MS` fixo. Continua limitada por `MAX_FRAME_DURATION_MS` via
 * `clampFrameDurationMs`. Sem valor, mantém o default de 100ms (mesmo comportamento de antes).
 */
export function renderLooktypeFrames(thing: ObdThingData, speedMs?: number | null): RenderedLooktypeFrame[] {
  const frames: RenderedLooktypeFrame[] = [];
  const durationMs = clampFrameDurationMs(speedMs ?? DEFAULT_FRAME_DURATION_MS);

  if (thing.category === "outfit") {
    const patternX = thing.patternX > SOUTH_DIRECTION_INDEX ? SOUTH_DIRECTION_INDEX : 0;
    for (let frame = 0; frame < thing.frames; frame++) {
      const rgba = composeFrame(thing, { patternX, patternY: 0, patternZ: 0, frame }, [0]);
      frames.push({ png: toPngBuffer(thing, rgba), durationMs });
    }
    return frames;
  }

  for (let frame = 0; frame < thing.frames; frame++) {
    for (let patternZ = 0; patternZ < thing.patternZ; patternZ++) {
      for (let patternY = 0; patternY < thing.patternY; patternY++) {
        for (let patternX = 0; patternX < thing.patternX; patternX++) {
          const layers = Array.from({ length: thing.layers }, (_, index) => index);
          const rgba = composeFrame(thing, { patternX, patternY, patternZ, frame }, layers);
          frames.push({ png: toPngBuffer(thing, rgba), durationMs });
        }
      }
    }
  }

  return frames;
}

/** Direções na convenção Tibia: 0=North, 1=East, 2=South, 3=West (mesma de `SOUTH_DIRECTION_INDEX`
 * acima). Usado só pra outfits — os outros `category` não têm noção de direção no jogo. */
export const OUTFIT_DIRECTION_COUNT = 4;

/** Nº máximo de slots de addon extras (além do corpo base, sempre no slot 0) — bate com o
 * bitmask de 2 bits do campo `addons` do outfit (0-3: nenhum, addon1, addon2, os dois). Slots
 * extras são camadas ADITIVAS desenhadas por cima da base (ex.: chapéu, mochila), cada uma com
 * sua própria layer de cor — não são variantes alternativas do corpo. Confirmado lendo o loop de
 * addon em `Creature::draw` do OTClient (`src/client/creature.cpp`): `yPattern=0` é sempre
 * desenhado; `yPattern=1`/`2` só quando o bit correspondente do outfit tá ligado, cada um por
 * cima do anterior. */
const OUTFIT_MAX_ADDON_SLOTS = 2;

export type RenderedOutfitLayer = {
  /** Sprite normal do slot (com sombreamento próprio já embutido). */
  base: Buffer;
  /**
   * Layer 1 crua (sem processamento) quando o outfit tem máscara de cor (`thing.layers >= 2`,
   * confirmado lendo `ThingType::loadTexture`/`Image::overwriteMask` do OTClient — a máscara é
   * UMA única sprite com 4 cores planas puras marcando as 4 regiões: vermelho=body, verde=legs,
   * azul=feet, amarelo=head; fora dessas 4 cores = sem cor). A separação por região e a
   * recoloração de fato acontecem no client (canvas), não aqui — ver
   * `components/shared/outfit-color-preview.tsx` e `lib/tibia-outfit-color.ts`.
   */
  mask: Buffer | null;
};

export type RenderedOutfitDirectionFrame = {
  /** Índice 0 = corpo base (sempre presente); 1 e 2 = addons extras, só presentes até
   * `RenderedOutfitResult.addonSlots`. */
  slots: RenderedOutfitLayer[];
};

export type RenderedOutfitResult = {
  /** Sempre `OUTFIT_DIRECTION_COUNT` entradas; direções além do que o `.obd` realmente tem
   * (`patternX`) repetem a única disponível, pra nunca faltar direção no preview. */
  directions: RenderedOutfitDirectionFrame[][];
  hasColorMask: boolean;
  /** 0 = outfit sem addon (só o slot base); 1 ou 2 = quantos slots extras foram renderizados. */
  addonSlots: number;
  durationMs: number;
};

/** Renderiza um outfit com as 4 direções, os slots de addon disponíveis e (quando existir) a
 * layer de máscara de cor de cada slot — complementar a `renderLooktypeFrames`, que continua
 * gravando só a pose Sul/corpo base/layer 0 pro preview genérico usado em outros CRUDs
 * (item/monstro/etc). Só faz sentido pra `category === "outfit"`. */
export function renderOutfitDirectionalFrames(thing: ObdThingData, speedMs?: number | null): RenderedOutfitResult {
  const durationMs = clampFrameDurationMs(speedMs ?? DEFAULT_FRAME_DURATION_MS);
  const hasColorMask = thing.layers >= 2;
  const availableDirections = Math.min(thing.patternX, OUTFIT_DIRECTION_COUNT) || 1;
  const addonSlots = Math.max(0, Math.min(thing.patternY, OUTFIT_MAX_ADDON_SLOTS + 1) - 1);

  const directions: RenderedOutfitDirectionFrame[][] = [];
  for (let direction = 0; direction < OUTFIT_DIRECTION_COUNT; direction++) {
    const patternX = direction < availableDirections ? direction : 0;
    const frames: RenderedOutfitDirectionFrame[] = [];
    for (let frame = 0; frame < thing.frames; frame++) {
      const slots: RenderedOutfitLayer[] = [];
      for (let patternY = 0; patternY <= addonSlots; patternY++) {
        const selection = { patternX, patternY, patternZ: 0, frame };
        const base = toPngBuffer(thing, composeFrame(thing, selection, [0]));
        const mask = hasColorMask ? toPngBuffer(thing, composeFrame(thing, selection, [1])) : null;
        slots.push({ base, mask });
      }
      frames.push({ slots });
    }
    directions.push(frames);
  }

  return { directions, hasColorMask, addonSlots, durationMs };
}
