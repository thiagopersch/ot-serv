import { z } from "zod";

import {
  WALL_SEGMENT_TYPES,
  alternateSchema,
  compositeSchema,
  itemRefSchema,
  type AlternateInput,
  type CompositeInput,
  type ItemRefInput,
} from "@/lib/validations/admin/doodad";

/**
 * `walls.xml` mistura brushes `wall`/`wall decoration` (auto-parede) com alguns
 * `doodad` (arcos/decorações que usam a mesma árvore item/composite/alternate dos
 * doodads — por isso reaproveitamos os schemas de `lib/validations/admin/doodad.ts`).
 */
export const WALL_FILE_BRUSH_TYPES = ["wall", "wall decoration", "doodad"] as const;
export type WallFileBrushType = (typeof WALL_FILE_BRUSH_TYPES)[number];

export function isWallSegmentBrushType(type: string): boolean {
  return type === "wall" || type === "wall decoration";
}

type ContentShapeInput = {
  type: string;
  walls: unknown[];
  items: unknown[];
  composites: unknown[];
  alternates: unknown[];
};

/**
 * O `type` do brush nem sempre indica a forma real do conteúdo: `walls.xml` tem
 * brushes `type="wall"` que usam <alternate>/<item> direto (estilo doodad) em vez de
 * <wall type="...">. Decide pelo que existe de fato, só caindo para `type` quando
 * ambos estão vazios (brush novo).
 */
export function resolveContentMode(input: ContentShapeInput): "wall" | "doodad" {
  if (input.walls.length > 0) return "wall";
  if (input.items.length > 0 || input.composites.length > 0 || input.alternates.length > 0) {
    return "doodad";
  }
  return isWallSegmentBrushType(input.type) ? "wall" : "doodad";
}

/**
 * Tipos de porta observados no `walls.xml` (bem mais ricos que os `any door`/`any window`
 * do `doodads.xml`). Mantido como sugestão (datalist), não enum — o arquivo real tem
 * variações/typos (`"hatch window"` vs `"hatch_window"`) que precisam ser preservados.
 */
export const COMMON_WALL_DOOR_TYPES = [
  "normal",
  "normal_alt",
  "locked",
  "quest",
  "magic",
  "hatch_window",
  "window",
  "archway",
  "any door",
  "any window",
] as const;

const wallDoorSchema = z.object({
  id: z.number().int(),
  type: z.string().min(1).max(50),
  /** `null` = atributo `open` ausente no XML (ex.: portas do tipo "window"). */
  open: z.boolean().nullable(),
  locked: z.boolean(),
});
export type WallDoorInput = z.infer<typeof wallDoorSchema>;

const wallSegmentSchema = z.object({
  type: z.enum(WALL_SEGMENT_TYPES),
  items: z.array(itemRefSchema),
  doors: z.array(wallDoorSchema),
});
export type WallSegmentInput = z.infer<typeof wallSegmentSchema>;

const friendSchema = z.object({
  name: z.string().min(1).max(255),
  redirect: z.boolean(),
});
export type FriendInput = z.infer<typeof friendSchema>;

export const baseWallFormSchema = z.object({
  name: z.string().min(1, "Informe o nome").max(255),
  type: z.enum(WALL_FILE_BRUSH_TYPES),
  serverLookId: z.number().int(),
  draggable: z.boolean(),
  onBlocking: z.boolean(),
  thickness: z.string().max(20),
  onDuplicate: z.boolean(),
  oneSize: z.boolean(),
  redoBorders: z.boolean(),
  reborder: z.boolean(),
  // conteúdo type="wall" / "wall decoration"
  walls: z.array(wallSegmentSchema),
  // conteúdo type="doodad" (arcos etc. reaproveitados de doodads.xml)
  items: z.array(itemRefSchema),
  composites: z.array(compositeSchema),
  alternates: z.array(alternateSchema),
  // redirecionamento de bordas com outro brush (<friend />), qualquer type
  friends: z.array(friendSchema),
  /** Categoria do tileset (tag `terrain`/`terrain_and_raw`) — obrigatório ao criar/editar
   * pelo CRUD (nullable só para não quebrar linhas legadas ainda não migradas). */
  tilesetCategoryId: z.number().int().nullable(),
});

export type WallFormInput = z.infer<typeof baseWallFormSchema>;

export const wallFormSchema = baseWallFormSchema.refine((data) => data.tilesetCategoryId != null, {
  message: "Selecione a categoria do tileset",
  path: ["tilesetCategoryId"],
});

export const defaultWallValues: WallFormInput = {
  name: "",
  type: "wall",
  serverLookId: 0,
  draggable: false,
  onBlocking: false,
  thickness: "10/100",
  onDuplicate: false,
  oneSize: false,
  redoBorders: false,
  reborder: false,
  walls: [],
  items: [],
  composites: [],
  alternates: [],
  friends: [],
  tilesetCategoryId: null,
};

export const emptyWallSegment: WallSegmentInput = { type: "horizontal", items: [], doors: [] };
export const emptyWallDoor: WallDoorInput = { id: 0, type: "normal", open: false, locked: false };
export const emptyFriend: FriendInput = { name: "", redirect: false };

export type { AlternateInput, CompositeInput, ItemRefInput };
