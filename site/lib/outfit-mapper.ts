import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import type { OutfitInput } from "@/lib/validations/admin/outfit";
import type { OutfitXmlData } from "@/lib/outfit-xml";

export const outfitInclude = {
  maleLooktype: true,
  femaleLooktype: true,
} satisfies Prisma.OutfitDefinitionInclude;

type OutfitWithLooktypes = Prisma.OutfitDefinitionGetPayload<{ include: typeof outfitInclude }>;

export type OutfitLooktypePreview = {
  id: number;
  name: string;
  looktypeNumber: number | null;
  frameCount: number;
  frameDurationsMs: number[];
  updatedAt: string;
};

/** Linha devolvida pela listagem/API — serve direto para `outfitToXml` e `outfitUnlockLua`. */
export type OutfitRow = OutfitInput &
  OutfitXmlData & {
    maleLooktype: OutfitLooktypePreview;
    femaleLooktype: OutfitLooktypePreview;
    unlockItemName: string | null;
  };

function looktypePreview(looktype: OutfitWithLooktypes["maleLooktype"]): OutfitLooktypePreview {
  return {
    id: looktype.id,
    name: looktype.name,
    looktypeNumber: looktype.looktypeNumber,
    frameCount: looktype.frameCount,
    frameDurationsMs: looktype.frameDurationsMs as number[],
    updatedAt: looktype.updatedAt.toISOString(),
  };
}

export function outfitToRow(outfit: OutfitWithLooktypes, unlockItemName: string | null = null): OutfitRow {
  return {
    id: outfit.id,
    name: outfit.name,
    type: outfit.type,
    premium: outfit.premium,
    storageId: outfit.storageId ?? "",
    storageValue: outfit.storageValue ?? "",
    maleLooktypeId: outfit.maleLooktypeId,
    femaleLooktypeId: outfit.femaleLooktypeId,
    unlockItemId: outfit.unlockItemId ?? 0,
    extraAttributes: (outfit.extraAttributes as Record<string, string> | null) ?? null,
    maleLooktypeNumber: outfit.maleLooktype.looktypeNumber,
    femaleLooktypeNumber: outfit.femaleLooktype.looktypeNumber,
    maleLooktype: looktypePreview(outfit.maleLooktype),
    femaleLooktype: looktypePreview(outfit.femaleLooktype),
    unlockItemName,
  };
}

/** Converte linhas do banco para `OutfitRow`, resolvendo o nome dos itens em uma query só. */
export async function outfitsToRows(
  client: Pick<PrismaClient, "item">,
  outfits: OutfitWithLooktypes[],
): Promise<OutfitRow[]> {
  const itemIds = [...new Set(outfits.map((o) => o.unlockItemId).filter((id): id is number => !!id))];
  const items = itemIds.length
    ? await client.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(items.map((item) => [item.id, item.name]));
  return outfits.map((outfit) => outfitToRow(outfit, outfit.unlockItemId ? nameById.get(outfit.unlockItemId) ?? null : null));
}

export function outfitInputToPrismaData(input: OutfitInput) {
  return {
    id: input.id,
    name: input.name,
    type: input.type,
    premium: input.premium,
    storageId: input.storageId || null,
    storageValue: input.storageId && input.storageValue ? input.storageValue : null,
    maleLooktypeId: input.maleLooktypeId,
    femaleLooktypeId: input.femaleLooktypeId,
    unlockItemId: input.unlockItemId > 0 ? input.unlockItemId : null,
  };
}

/** Lê `?ids=1,2,3` (export/lua em lote). `null` = todos. */
export function parseSelectedIds(url: URL): number[] | null {
  const raw = url.searchParams.get("ids");
  if (!raw) return null;
  const ids = raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isInteger(id));
  return ids.length > 0 ? ids : null;
}
