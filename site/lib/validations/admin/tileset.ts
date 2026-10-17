import { z } from "zod";

/** Nome literal da tag XML de categoria dentro de `<tileset>` no `tilesets.xml` (RME). */
export const TILESET_CATEGORY_KINDS = [
  "TERRAIN",
  "TERRAIN_AND_RAW",
  "DOODAD",
  "DOODAD_AND_RAW",
  "RAW",
  "ITEMS",
  "ITEMS_AND_RAW",
] as const;
export type TilesetCategoryKind = (typeof TILESET_CATEGORY_KINDS)[number];

export const TILESET_CATEGORY_TYPES = ["BRUSH", "ITEM"] as const;
export type TilesetCategoryType = (typeof TILESET_CATEGORY_TYPES)[number];

const BRUSH_KINDS: TilesetCategoryKind[] = ["TERRAIN", "TERRAIN_AND_RAW", "DOODAD", "DOODAD_AND_RAW"];
const ITEM_KINDS: TilesetCategoryKind[] = ["RAW", "ITEMS", "ITEMS_AND_RAW"];

/** `kind` -> `type` (BRUSH/ITEM) derivado automaticamente a partir da tag XML. */
export function categoryTypeForKind(kind: TilesetCategoryKind): TilesetCategoryType {
  return BRUSH_KINDS.includes(kind) ? "BRUSH" : "ITEM";
}

export function kindsForType(type: TilesetCategoryType): TilesetCategoryKind[] {
  return type === "BRUSH" ? BRUSH_KINDS : ITEM_KINDS;
}

/** Kinds que aceitam brushes de Ground/WallBrush (tag `terrain`/`terrain_and_raw`). */
export const TERRAIN_KINDS: TilesetCategoryKind[] = ["TERRAIN", "TERRAIN_AND_RAW"];
/** Kinds que aceitam brushes de DoodadBrush (tag `doodad`/`doodad_and_raw`). */
export const DOODAD_KINDS: TilesetCategoryKind[] = ["DOODAD", "DOODAD_AND_RAW"];

export const TILESET_ITEM_ENTRY_KINDS = ["ITEM_ID", "ITEM_RANGE"] as const;
export type TilesetItemEntryKind = (typeof TILESET_ITEM_ENTRY_KINDS)[number];

// --- Formulários (admin CRUD) -------------------------------------------------

export const tilesetFormSchema = z.object({
  id: z.number().int().optional(),
  name: z.string().min(1, "Informe o nome").max(255),
  description: z.string().max(500).nullable(),
  order: z.number().int(),
  active: z.boolean(),
  icon: z.string().max(255).nullable(),
  /** Se `true`, os ids de item derivados dos brushes aparecem misturados na própria
   * categoria (`<terrain>`/`<doodad>`, como um `_and_raw`). Se `false`, saem numa tag
   * `<raw>` separada ao final do tileset exportado. */
  rawIdsInBrush: z.boolean(),
});
export type TilesetFormInput = z.infer<typeof tilesetFormSchema>;

export const defaultTilesetValues: TilesetFormInput = {
  name: "",
  description: null,
  order: 0,
  active: true,
  icon: null,
  rawIdsInBrush: false,
};

export const tilesetItemEntryFormSchema = z
  .object({
    id: z.number().int().optional(),
    order: z.number().int(),
    kind: z.enum(TILESET_ITEM_ENTRY_KINDS),
    itemId: z.number().int().nullable(),
    fromId: z.number().int().nullable(),
    toId: z.number().int().nullable(),
  })
  .refine((entry) => (entry.kind === "ITEM_ID" ? entry.itemId != null && entry.itemId > 0 : true), {
    message: "Informe o id do item",
    path: ["itemId"],
  })
  .refine(
    (entry) =>
      entry.kind === "ITEM_RANGE" ? entry.fromId != null && entry.toId != null && entry.toId >= entry.fromId : true,
    { message: "Intervalo inválido (toId deve ser >= fromId)", path: ["toId"] }
  );
export type TilesetItemEntryFormInput = z.infer<typeof tilesetItemEntryFormSchema>;

export const tilesetCategoryFormSchema = z
  .object({
    id: z.number().int().optional(),
    tilesetId: z.number().int(),
    name: z.string().min(1, "Informe o nome").max(255),
    kind: z.enum(TILESET_CATEGORY_KINDS),
    type: z.enum(TILESET_CATEGORY_TYPES),
    order: z.number().int(),
    description: z.string().max(500).nullable(),
  })
  .refine((category) => categoryTypeForKind(category.kind) === category.type, {
    message: "type não corresponde ao kind informado",
    path: ["type"],
  });
export type TilesetCategoryFormInput = z.infer<typeof tilesetCategoryFormSchema>;

export const defaultTilesetCategoryValues: Omit<TilesetCategoryFormInput, "tilesetId"> = {
  name: "",
  kind: "TERRAIN",
  type: "BRUSH",
  order: 0,
  description: null,
};

// --- Forma "resolvida" usada pelo writer/parser XML e pelo preview ao vivo ---

export type TilesetXmlEntry =
  | { type: "brush"; name: string; order: number }
  | { type: "item"; itemId: number; order: number }
  | { type: "itemRange"; fromId: number; toId: number; order: number };

export type TilesetXmlCategory = {
  name: string;
  kind: TilesetCategoryKind;
  entries: TilesetXmlEntry[];
};

export type TilesetXmlDocument = {
  name: string;
  categories: TilesetXmlCategory[];
};
