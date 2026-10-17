import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import { type ExtOutfitInput, type ExtOutfitKind, extOutfitValueField } from "@/lib/validations/admin/extoutfit";
import type { ExtOutfitXmlData } from "@/lib/extoutfit-xml";
import type { OutfitLooktypePreview } from "@/lib/outfit-mapper";
import { shaderTex1Url } from "@/lib/extoutfit-shader-storage";
import { listExtOutfitFiles, type ExtOutfitFileRef } from "@/lib/extoutfit-files";

export const extOutfitInclude = { looktype: true } satisfies Prisma.ExtOutfitInclude;

type ExtOutfitWithLooktype = Prisma.ExtOutfitGetPayload<{ include: typeof extOutfitInclude }>;

/** Sprite vinculada com os campos que o preview composto precisa (direção/camadas). */
export type ExtOutfitLooktypePreview = OutfitLooktypePreview & {
  directions: number;
  hasColorMask: boolean;
  addonSlots: number;
};

/** Linha devolvida pela listagem/API — serve direto para `extOutfitToXml`. O conteúdo dos `.frag`
 * não vem aqui (só flags); o preview busca em `/api/admin/extoutfits/[id]/shader`. */
export type ExtOutfitRow = ExtOutfitInput &
  ExtOutfitXmlData & {
    id: number;
    looktype: ExtOutfitLooktypePreview | null;
    hasShaderSource: boolean;
    hasShaderVertex: boolean;
    shaderFileName: string | null;
    shaderTex1Url: string | null;
    updatedAt: string;
    /** Arquivos de cliente disponíveis para download (imagem, .frag, ...), conforme o tipo. */
    files: ExtOutfitFileRef[];
  };

/** `imageExtension` = extensão da imagem enviada (`EntityImage`), quando houver. */
export function extOutfitToRow(entry: ExtOutfitWithLooktype, imageExtension: string | null = null): ExtOutfitRow {
  return {
    id: entry.id,
    kind: entry.kind as ExtOutfitKind,
    xmlId: entry.xmlId,
    name: entry.name,
    looktypeId: entry.looktypeId ?? 0,
    shaderName: entry.shaderName ?? "",
    image: entry.image ?? "",
    posx: entry.posx,
    posy: entry.posy,
    looktypeNumber: entry.looktype?.looktypeNumber ?? null,
    looktype: entry.looktype
      ? {
          id: entry.looktype.id,
          name: entry.looktype.name,
          looktypeNumber: entry.looktype.looktypeNumber,
          frameCount: entry.looktype.frameCount,
          frameDurationsMs: entry.looktype.frameDurationsMs as number[],
          updatedAt: entry.looktype.updatedAt.toISOString(),
          directions: entry.looktype.directions,
          hasColorMask: entry.looktype.hasColorMask,
          addonSlots: entry.looktype.addonSlots,
        }
      : null,
    hasShaderSource: !!entry.shaderSource,
    hasShaderVertex: !!entry.shaderVertexSource,
    shaderFileName: entry.shaderFileName,
    shaderTex1Url: entry.shaderTex1Ext ? shaderTex1Url(entry.id, entry.shaderTex1Ext, entry.updatedAt) : null,
    updatedAt: entry.updatedAt.toISOString(),
    files: listExtOutfitFiles(
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
    ),
  };
}

/** Extensão da imagem enviada de cada registro (uma query para a página inteira). */
export async function extOutfitImageExtensions(
  client: Pick<PrismaClient, "entityImage">,
  ids: number[],
): Promise<Map<number, string>> {
  if (ids.length === 0) return new Map();
  const images = await client.entityImage.findMany({
    where: { entityType: "extoutfit", entityId: { in: ids } },
    select: { entityId: true, extension: true },
  });
  return new Map(images.map((image) => [image.entityId, image.extension]));
}

/** Grava só o atributo de aparência que a tag usa no XML. `looktypeId` é aceito em todos os tipos:
 * em wings/auras é o valor do XML; nos demais, só a sprite de preview. */
export function extOutfitInputToPrismaData(input: ExtOutfitInput) {
  const field = extOutfitValueField(input.kind);
  return {
    kind: input.kind,
    xmlId: input.xmlId,
    name: input.name,
    looktypeId: input.looktypeId > 0 ? input.looktypeId : null,
    shaderName: field === "shadername" ? input.shaderName : null,
    image: field === "image" ? input.image : null,
    posx: input.posx,
    posy: input.posy,
  };
}
