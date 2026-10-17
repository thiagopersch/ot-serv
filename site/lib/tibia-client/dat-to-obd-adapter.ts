/**
 * Converte um `TibiaDatThing` (lido do `.dat` cru, ver `dat-parser.ts`) num `ObdThingData` — a
 * mesma estrutura que `lib/obd/obd-parser.ts` produz a partir de um `.obd` do Object Builder.
 * Isso permite reaproveitar `renderLooktypeFrames`/`composeFrame`/`argbToRgba` de
 * `lib/obd/obd-render.ts` sem NENHUMA alteração: a ordem dos `spriteIds` no `.dat` já bate 1:1
 * com a ordem esperada por `getObdSpriteIndex` (frame → patternZ → patternY → patternX → layer →
 * height → width, do mais externo ao mais interno).
 *
 * `frameDurations` sempre vazio: o `.dat` de um cliente 8.6 não carrega duração por frame (isso só
 * existe em clientes ~10.50+) — `renderLooktypeFrames` já lida com isso usando `speedMs` fixo
 * quando `frameDurations` está vazio, igual ao que já acontece hoje para `.obd`s com `frames<=1`.
 */
import type { ObdThingData } from "@/lib/obd/obd-parser";
import type { TibiaDatThing } from "@/lib/tibia-client/dat-parser";
import type { TibiaSprReader } from "@/lib/tibia-client/spr-parser";

export function toObdThingData(thing: TibiaDatThing, spr: TibiaSprReader, clientVersion = 860): ObdThingData {
  return {
    clientVersion,
    category: thing.category,
    width: thing.width,
    height: thing.height,
    layers: thing.layers,
    patternX: thing.patternX,
    patternY: thing.patternY,
    patternZ: thing.patternZ,
    frames: thing.frames,
    frameDurations: [],
    sprites: thing.spriteIds.map((spriteId) => spr.getSpriteArgb(spriteId)),
  };
}
