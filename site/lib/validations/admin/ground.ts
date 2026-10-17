import { z } from "zod";

import { itemRefSchema } from "@/lib/validations/admin/doodad";

export const GROUND_BORDER_ALIGNS = ["outer", "inner"] as const;
export type GroundBorderAlign = (typeof GROUND_BORDER_ALIGNS)[number];

const groundBorderRefSchema = z.object({
  align: z.enum(GROUND_BORDER_ALIGNS),
  /** `null` = atributo `to` ausente. Valores observados: nome de outro ground, "none", "all". */
  to: z.string().nullable(),
  borderId: z.number().int(),
});
export type GroundBorderRefInput = z.infer<typeof groundBorderRefSchema>;

const groundFriendSchema = z.object({
  name: z.string().min(1).max(255),
});
export type GroundFriendInput = z.infer<typeof groundFriendSchema>;

export const baseGroundFormSchema = z.object({
  name: z.string().min(1, "Informe o nome").max(255),
  serverLookId: z.number().int(),
  zOrder: z.number().int(),
  soloOptional: z.boolean(),
  items: z.array(itemRefSchema),
  borders: z.array(groundBorderRefSchema),
  friends: z.array(groundFriendSchema),
  /** Categoria do tileset (tag `terrain`/`terrain_and_raw`) — obrigatório ao criar/editar
   * pelo CRUD (nullable só para não quebrar linhas legadas ainda não migradas). */
  tilesetCategoryId: z.number().int().nullable(),
});
export type GroundFormInput = z.infer<typeof baseGroundFormSchema>;

export const groundFormSchema = baseGroundFormSchema.refine((data) => data.tilesetCategoryId != null, {
  message: "Selecione a categoria do tileset",
  path: ["tilesetCategoryId"],
});

export const defaultGroundValues: GroundFormInput = {
  name: "",
  serverLookId: 0,
  zOrder: 0,
  soloOptional: false,
  items: [],
  borders: [],
  friends: [],
  tilesetCategoryId: null,
};

export const emptyGroundBorderRef: GroundBorderRefInput = { align: "outer", to: null, borderId: 0 };
export const emptyGroundFriend: GroundFriendInput = { name: "" };
