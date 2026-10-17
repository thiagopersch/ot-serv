import { promises as fs } from "node:fs";

import type { ExtOutfit } from "@/lib/generated/prisma/client";
import { entityImageStoragePath } from "@/lib/entity-image";
import { shaderTex1StoragePath } from "@/lib/extoutfit-shader-storage";
import { listExtOutfitFiles, type ExtOutfitFileRef } from "@/lib/extoutfit-files";

export function extOutfitFileRefs(entry: ExtOutfit, imageExtension: string | null): ExtOutfitFileRef[] {
  return listExtOutfitFiles(
    {
      kind: entry.kind,
      xmlId: entry.xmlId,
      name: entry.name,
      image: entry.image,
      shaderName: entry.shaderName,
      shaderFileName: entry.shaderFileName,
      hasShaderSource: !!entry.shaderSource,
      hasShaderVertex: !!entry.shaderVertexSource,
      shaderTex1Ext: entry.shaderTex1Ext,
    },
    imageExtension,
  );
}

/** Conteúdo original do arquivo (bytes intactos — APNG/GIF preservados). `null` se sumiu do disco. */
export async function readExtOutfitFile(
  entry: ExtOutfit,
  file: ExtOutfitFileRef,
  imageExtension: string | null,
): Promise<Uint8Array | null> {
  switch (file.part) {
    case "fragment":
      return entry.shaderSource ? new TextEncoder().encode(entry.shaderSource) : null;
    case "vertex":
      return entry.shaderVertexSource ? new TextEncoder().encode(entry.shaderVertexSource) : null;
    case "tex1":
      return entry.shaderTex1Ext
        ? fs.readFile(shaderTex1StoragePath(entry.id, entry.shaderTex1Ext)).catch(() => null)
        : null;
    case "image":
      return imageExtension
        ? fs.readFile(entityImageStoragePath("extoutfit", entry.id, imageExtension)).catch(() => null)
        : null;
  }
}
