import path from "node:path";

import { storageSpriteUrl } from "@/lib/sprite-hd";

/** Frames ficam em `public/storage/looktypes/{id}/{frameIndex}.png`, servidos estaticamente
 * pelo Next (mesmo esquema/limitação de volume persistente descrita em `lib/entity-image.ts`). */
export function looktypeFrameStoragePath(looktypeId: number, frameIndex: number): string {
  return path.join(process.cwd(), "public", "storage", "looktypes", String(looktypeId), `${frameIndex}.png`);
}

export function looktypeFrameDirPath(looktypeId: number): string {
  return path.join(process.cwd(), "public", "storage", "looktypes", String(looktypeId));
}

/** `hd`: versão xBRZ 2x gerada sob demanda (ver `lib/sprite-hd.ts`). */
export function looktypeFrameUrl(looktypeId: number, frameIndex: number, updatedAt: Date, hd = false): string {
  return `${storageSpriteUrl(`looktypes/${looktypeId}/${frameIndex}.png`, hd)}?v=${updatedAt.getTime()}`;
}

/** Camadas extras gravadas só pra outfits com direção/máscara de cor/addon (ver
 * `renderOutfitDirectionalFrames` em `lib/obd/obd-render.ts`) — ficam em
 * `{id}/{direction}/{addonSlot}/{base|mask}/{frame}.png` (slot 0 = corpo base, sempre presente;
 * 1/2 = addons extras, aditivos por cima da base), ao lado (não em vez) dos arquivos gerados por
 * `renderLooktypeFrames`/`looktypeFrameStoragePath` (que continuam servindo o preview genérico,
 * sempre Sul/sem cor/sem addon, usado em outros CRUDs). */
export function looktypeOutfitLayerStoragePath(
  looktypeId: number,
  direction: number,
  addonSlot: number,
  layer: "base" | "mask",
  frameIndex: number,
): string {
  return path.join(
    process.cwd(),
    "public",
    "storage",
    "looktypes",
    String(looktypeId),
    String(direction),
    String(addonSlot),
    layer,
    `${frameIndex}.png`,
  );
}

export function looktypeOutfitLayerDirPath(
  looktypeId: number,
  direction: number,
  addonSlot: number,
  layer: "base" | "mask",
): string {
  return path.join(
    process.cwd(),
    "public",
    "storage",
    "looktypes",
    String(looktypeId),
    String(direction),
    String(addonSlot),
    layer,
  );
}

export function looktypeOutfitLayerUrl(
  looktypeId: number,
  direction: number,
  addonSlot: number,
  layer: "base" | "mask",
  frameIndex: number,
  updatedAt: Date,
  hd = false,
): string {
  const relativePath = `looktypes/${looktypeId}/${direction}/${addonSlot}/${layer}/${frameIndex}.png`;
  return `${storageSpriteUrl(relativePath, hd)}?v=${updatedAt.getTime()}`;
}
