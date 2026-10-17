import type { DoodadBrush, Ground, Tileset, TilesetCategory, TilesetItemEntry, WallBrush } from "@/lib/generated/prisma/client";
import type {
  TilesetCategoryFormInput,
  TilesetCategoryKind,
  TilesetFormInput,
  TilesetItemEntryFormInput,
  TilesetXmlCategory,
  TilesetXmlDocument,
  TilesetXmlEntry,
} from "@/lib/validations/admin/tileset";
import { doodadItemIds, groundItemIds, wallItemIds } from "@/lib/brush-item-ids";

export function tilesetToFormInput(tileset: Tileset): TilesetFormInput {
  return {
    id: tileset.id,
    name: tileset.name,
    description: tileset.description,
    order: tileset.order,
    active: tileset.active,
    icon: tileset.icon,
    rawIdsInBrush: tileset.rawIdsInBrush,
  };
}

export function tilesetCategoryToFormInput(category: TilesetCategory): TilesetCategoryFormInput {
  return {
    id: category.id,
    tilesetId: category.tilesetId,
    name: category.name,
    kind: category.kind as TilesetCategoryKind,
    type: category.type as TilesetCategoryFormInput["type"],
    order: category.order,
    description: category.description,
  };
}

export function tilesetItemEntryToFormInput(entry: TilesetItemEntry): TilesetItemEntryFormInput {
  return {
    id: entry.id,
    order: entry.order,
    kind: entry.kind as TilesetItemEntryFormInput["kind"],
    itemId: entry.itemId,
    fromId: entry.fromId,
    toId: entry.toId,
  };
}

type GroundBrushRef = Pick<Ground, "name" | "tilesetOrder" | "items">;
type WallBrushRef = Pick<WallBrush, "name" | "tilesetOrder" | "content">;
type DoodadBrushRef = Pick<DoodadBrush, "name" | "tilesetOrder" | "content">;

export type TilesetCategoryWithEntries = TilesetCategory & {
  grounds: GroundBrushRef[];
  walls: WallBrushRef[];
  doodads: DoodadBrushRef[];
  itemEntries: TilesetItemEntry[];
};

/** Junta os brushes vinculados (Ground/WallBrush/DoodadBrush por `tilesetCategoryId`),
 * os item ids que cada um desses brushes usa internamente (grama/tocos de um ground,
 * item/porta de cada segmento de parede, etc. — sempre recalculado a partir do que
 * está configurado no CRUD do brush, nunca curado manualmente), as entradas de item
 * soltas e os nomes de brush não resolvidos preservados na importação — para gerar a
 * categoria XML final. RME já mistura `<brush>` e `<item>` na mesma tag em categorias
 * reais (ex.: `doodad`, `terrain_and_raw`), então isso é compatível com o formato.
 *
 * `includeRawIds` controla só os ids *derivados* dos brushes (a mistura em si é opt-out
 * por `Tileset.rawIdsInBrush`): quando `false`, eles saem de `entries` e voltam em
 * `rawItemIds` para o chamador (`tilesetToXmlDocument`) agrupar numa tag `<raw>` própria
 * em vez de misturar na categoria original. */
export function tilesetCategoryToXmlCategory(
  category: TilesetCategoryWithEntries,
  options: { includeRawIds: boolean } = { includeRawIds: true }
): { category: TilesetXmlCategory; rawItemIds: number[] } {
  const brushEntries: TilesetXmlEntry[] = [...category.grounds, ...category.walls, ...category.doodads].map((brush) => ({
    type: "brush",
    name: brush.name,
    order: brush.tilesetOrder,
  }));

  const itemEntries: TilesetXmlEntry[] = category.itemEntries.map((entry) =>
    entry.kind === "ITEM_ID"
      ? { type: "item", itemId: entry.itemId ?? 0, order: entry.order }
      : { type: "itemRange", fromId: entry.fromId ?? 0, toId: entry.toId ?? 0, order: entry.order }
  );

  const derivedItemIds = new Set<number>();
  for (const ground of category.grounds) for (const id of groundItemIds(ground)) derivedItemIds.add(id);
  for (const wall of category.walls) for (const id of wallItemIds(wall)) derivedItemIds.add(id);
  for (const doodad of category.doodads) for (const id of doodadItemIds(doodad)) derivedItemIds.add(id);
  // Não duplica um id que já foi adicionado manualmente como TilesetItemEntry.
  for (const entry of category.itemEntries) {
    if (entry.kind === "ITEM_ID" && entry.itemId != null) derivedItemIds.delete(entry.itemId);
  }

  const unresolvedNames = Array.isArray(category.unresolvedBrushNames)
    ? (category.unresolvedBrushNames as unknown[]).filter((n): n is string => typeof n === "string")
    : [];

  let order = brushEntries.length + itemEntries.length;
  const sortedDerivedItemIds = Array.from(derivedItemIds).sort((a, b) => a - b);
  const derivedEntries: TilesetXmlEntry[] = options.includeRawIds
    ? sortedDerivedItemIds.map((itemId) => ({ type: "item", itemId, order: order++ }))
    : [];
  const unresolvedEntries: TilesetXmlEntry[] = unresolvedNames.map((name) => ({
    type: "brush",
    name,
    order: order++,
  }));

  return {
    category: {
      name: category.name,
      kind: category.kind as TilesetCategoryKind,
      entries: [...brushEntries, ...itemEntries, ...derivedEntries, ...unresolvedEntries],
    },
    rawItemIds: options.includeRawIds ? [] : sortedDerivedItemIds,
  };
}

export function tilesetToXmlDocument(tileset: Tileset & { categories: TilesetCategoryWithEntries[] }): TilesetXmlDocument {
  const results = [...tileset.categories]
    .sort((a, b) => a.order - b.order)
    .map((category) => tilesetCategoryToXmlCategory(category, { includeRawIds: tileset.rawIdsInBrush }));

  const categories = results.map((result) => result.category);

  if (!tileset.rawIdsInBrush) {
    const rawItemIds = new Set<number>();
    for (const result of results) for (const itemId of result.rawItemIds) rawItemIds.add(itemId);

    if (rawItemIds.size > 0) {
      let order = 0;
      const sortedRawItemIds = Array.from(rawItemIds).sort((a, b) => a - b);
      categories.push({
        name: "",
        kind: "RAW",
        entries: sortedRawItemIds.map((itemId) => ({ type: "item", itemId, order: order++ })),
      });
    }
  }

  return { name: tileset.name, categories };
}
