import { promises as fs } from "node:fs";

import type { RenderedOutfitResult } from "@/lib/obd/obd-render";
import { looktypeOutfitLayerDirPath, looktypeOutfitLayerStoragePath } from "@/lib/looktype-storage";

export type OutfitFrameFields = { directions: number; hasColorMask: boolean; addonSlots: number };

/** Deriva os campos a persistir em `Looktype.directions`/`hasColorMask`/`addonSlots` a partir do
 * resultado de `renderOutfitDirectionalFrames` — chame isso (barato, sem I/O) antes de
 * criar/atualizar o registro, e `writeOutfitDirectionalFrames` (abaixo, com I/O) depois, quando o
 * `looktypeId` já for conhecido. */
export function outfitFrameFieldsFrom(result: RenderedOutfitResult): OutfitFrameFields {
  return { directions: result.directions.length, hasColorMask: result.hasColorMask, addonSlots: result.addonSlots };
}

/**
 * Grava em disco as 4 direções, os slots de addon (0 = corpo base, 1/2 = addons extras) e a
 * layer de máscara de cor de cada slot (quando existir) de um outfit já renderizado
 * (`renderOutfitDirectionalFrames`).
 *
 * Único lugar que faz essa gravação — todo ponto que cria/atualiza um `Looktype` de outfit a
 * partir de um `.obd` (criação em lote, edição/"substituir arquivo", import do cliente Tibia,
 * upload direto de sprite em Monstro/Vocação) deve chamar esta função em vez de duplicar a
 * lógica de mkdir/writeFile — foi esquecer de um desses lugares (a rota de "substituir arquivo"
 * da edição) que inicialmente deixou o preview de direção/cor do CRUD de NPC sem atualizar
 * depois de um reenvio.
 */
export async function writeOutfitDirectionalFrames(looktypeId: number, result: RenderedOutfitResult): Promise<void> {
  for (let direction = 0; direction < result.directions.length; direction++) {
    for (let slot = 0; slot <= result.addonSlots; slot++) {
      await fs.mkdir(looktypeOutfitLayerDirPath(looktypeId, direction, slot, "base"), { recursive: true });
      if (result.hasColorMask) {
        await fs.mkdir(looktypeOutfitLayerDirPath(looktypeId, direction, slot, "mask"), { recursive: true });
      }
    }
  }

  await Promise.all(
    result.directions.flatMap((frames, direction) =>
      frames.flatMap((frame, frameIndex) =>
        frame.slots.flatMap((slotLayer, slot) => {
          const writes = [
            fs.writeFile(looktypeOutfitLayerStoragePath(looktypeId, direction, slot, "base", frameIndex), slotLayer.base),
          ];
          if (slotLayer.mask) {
            writes.push(
              fs.writeFile(
                looktypeOutfitLayerStoragePath(looktypeId, direction, slot, "mask", frameIndex),
                slotLayer.mask,
              ),
            );
          }
          return writes;
        }),
      ),
    ),
  );
}

/** Valores neutros pra quando a sprite de um outfit é removida/substituída por algo sem
 * direção/máscara/addon (ex.: imagem estática PNG/GIF, ou `DELETE` da imagem) — sem isso um
 * outfit que já tinha sido reprocessado ficaria com esses campos desatualizados apontando pra
 * arquivos que não existem mais. */
export const RESET_OUTFIT_FRAME_FIELDS: OutfitFrameFields = { directions: 1, hasColorMask: false, addonSlots: 0 };
