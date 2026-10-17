import { z } from "zod";

export const DOODAD_BRUSH_TYPES = ["doodad", "carpet", "wall", "wall decoration", "table"] as const;
export type DoodadBrushType = (typeof DOODAD_BRUSH_TYPES)[number];

/** `wall decoration` é uma variante de `wall` (mesma tag <wall>/<door> por dentro). */
export function isWallBrushType(type: string): boolean {
  return type === "wall" || type === "wall decoration";
}

export const CARPET_ALIGNS = [
  "n",
  "e",
  "s",
  "w",
  "cnw",
  "cne",
  "cse",
  "csw",
  "dnw",
  "dne",
  "dse",
  "dsw",
  "center",
] as const;
export type CarpetAlign = (typeof CARPET_ALIGNS)[number];

export const WALL_SEGMENT_TYPES = [
  "horizontal",
  "vertical",
  "pole",
  "corner",
  "intersection",
  "north end",
  "south end",
  "east end",
  "west end",
  "north T",
  "south T",
  "east T",
  "west T",
  "northeast diagonal",
  "northwest diagonal",
  "southeast diagonal",
  "southwest diagonal",
] as const;
export type WallSegmentType = (typeof WALL_SEGMENT_TYPES)[number];

export const DOOR_TYPES = ["any door", "any window"] as const;
export type DoorType = (typeof DOOR_TYPES)[number];

export const TABLE_ALIGNS = [
  "alone",
  "horizontal",
  "vertical",
  "north",
  "south",
  "east",
  "west",
] as const;
export type TableAlign = (typeof TABLE_ALIGNS)[number];

export const itemRefSchema = z.object({
  id: z.number().int(),
  /** `null` = atributo `chance` ausente no XML (item único, sem peso de sorteio). */
  chance: z.number().int().nullable(),
});

export const tileSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  z: z.number().int().nullable(),
  items: z.array(itemRefSchema),
});

export const compositeSchema = z.object({
  chance: z.number().int(),
  tiles: z.array(tileSchema),
});

export const alternateSchema = z.object({
  items: z.array(itemRefSchema),
  composites: z.array(compositeSchema),
});

const carpetEntrySchema = z.object({
  align: z.enum(CARPET_ALIGNS),
  id: z.number().int(),
});

const wallDoorSchema = z.object({
  id: z.number().int(),
  type: z.enum(DOOR_TYPES),
  open: z.boolean(),
  hate: z.boolean(),
});

const wallSegmentSchema = z.object({
  type: z.enum(WALL_SEGMENT_TYPES),
  items: z.array(itemRefSchema),
  doors: z.array(wallDoorSchema),
});

const tableSegmentSchema = z.object({
  align: z.enum(TABLE_ALIGNS),
  items: z.array(itemRefSchema),
});

export const baseDoodadFormSchema = z.object({
  name: z.string().min(1, "Informe o nome").max(255),
  type: z.enum(DOODAD_BRUSH_TYPES),
  serverLookId: z.number().int(),
  draggable: z.boolean(),
  onBlocking: z.boolean(),
  thickness: z.string().max(20),
  onDuplicate: z.boolean(),
  oneSize: z.boolean(),
  redoBorders: z.boolean(),
  reborder: z.boolean(),
  items: z.array(itemRefSchema),
  composites: z.array(compositeSchema),
  alternates: z.array(alternateSchema),
  carpets: z.array(carpetEntrySchema),
  walls: z.array(wallSegmentSchema),
  tables: z.array(tableSegmentSchema),
  /** Categoria do tileset (tag `doodad`/`doodad_and_raw`) — obrigatório ao criar/editar
   * pelo CRUD (nullable só para não quebrar linhas legadas ainda não migradas). */
  tilesetCategoryId: z.number().int().nullable(),
});

export type DoodadFormInput = z.infer<typeof baseDoodadFormSchema>;

export const doodadFormSchema = baseDoodadFormSchema.refine((data) => data.tilesetCategoryId != null, {
  message: "Selecione a categoria do tileset",
  path: ["tilesetCategoryId"],
});
export type ItemRefInput = z.infer<typeof itemRefSchema>;
export type TileInput = z.infer<typeof tileSchema>;
export type CompositeInput = z.infer<typeof compositeSchema>;
export type AlternateInput = z.infer<typeof alternateSchema>;
export type WallSegmentInput = z.infer<typeof wallSegmentSchema>;
export type TableSegmentInput = z.infer<typeof tableSegmentSchema>;
export type CarpetEntryInput = z.infer<typeof carpetEntrySchema>;

export const defaultCarpetEntries: CarpetEntryInput[] = CARPET_ALIGNS.map((align) => ({
  align,
  id: 0,
}));

export const defaultDoodadValues: DoodadFormInput = {
  name: "",
  type: "doodad",
  serverLookId: 0,
  draggable: false,
  onBlocking: false,
  thickness: "10/100",
  onDuplicate: false,
  oneSize: false,
  redoBorders: false,
  reborder: false,
  items: [],
  composites: [],
  alternates: [],
  carpets: defaultCarpetEntries,
  walls: [],
  tables: [],
  tilesetCategoryId: null,
};

export const emptyItemRef: ItemRefInput = { id: 0, chance: 0 };
export const emptyTile: TileInput = { x: 0, y: 0, z: null, items: [] };
export const emptyComposite: CompositeInput = { chance: 0, tiles: [] };
export const emptyAlternate: AlternateInput = { items: [], composites: [] };
export const emptyWallSegment: WallSegmentInput = {
  type: "horizontal",
  items: [],
  doors: [],
};
export const emptyWallDoor = { id: 0, type: "any door" as DoorType, open: false, hate: false };
export const emptyTableSegment: TableSegmentInput = { align: "alone", items: [] };
