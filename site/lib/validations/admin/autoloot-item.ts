import { z } from "zod";

/** Tipos do autoloot (mesmas chaves de `AUTOLOOT_CATEGORIES` no servidor e de `CATEGORIES` no
 * module game_autoloot do OTC). Vazio = automático, classificado pelo items.xml no servidor. */
export const AUTOLOOT_CATEGORIES = [
  "helmet",
  "armor",
  "legs",
  "boots",
  "shield",
  "weapon",
  "ammo",
  "amulet",
  "ring",
  "potion",
  "healing",
  "food",
  "rune",
  "fragment",
  "quest",
  "money",
  "backpack",
  "other",
] as const;

export type AutolootCategory = (typeof AUTOLOOT_CATEGORIES)[number];

/** "Nome em inglês (português)" — o inglês é o mesmo texto mostrado no module do OTC. */
export const AUTOLOOT_CATEGORY_LABELS: Record<AutolootCategory, string> = {
  helmet: "Helmets (Capacetes)",
  armor: "Armors (Armaduras)",
  legs: "Legs (Calças)",
  boots: "Boots (Botas)",
  shield: "Shields (Escudos)",
  weapon: "Weapons (Armas)",
  ammo: "Ammunition (Munição)",
  amulet: "Amulets (Amuletos)",
  ring: "Rings (Anéis)",
  potion: "Potions (Poções)",
  healing: "Healing (Cura)",
  food: "Foods (Comidas)",
  rune: "Runes (Runas)",
  fragment: "Fragments (Fragmentos)",
  quest: "Quest items (Itens de quest/missão)",
  money: "Money (Dinheiro)",
  backpack: "Backpacks (Mochilas)",
  other: "Others (Outros)",
};

export const autolootItemSchema = z.object({
  itemId: z.number().int().positive(),
  name: z.string().min(1).max(255),
  category: z.enum(["", ...AUTOLOOT_CATEGORIES]).default(""),
  published: z.boolean().default(true),
});

export type AutolootItemInput = z.infer<typeof autolootItemSchema>;

/** PATCH parcial — sem `.default()`: no Zod 4 o `.partial()` ainda aplica os defaults, o que
 * resetaria `category`/`published` ao editar só um dos campos. */
export const autolootItemUpdateSchema = z.object({
  itemId: z.number().int().positive().optional(),
  name: z.string().min(1).max(255).optional(),
  category: z.enum(["", ...AUTOLOOT_CATEGORIES]).optional(),
  published: z.boolean().optional(),
});

/** `name` é opcional: a rota resolve o nome real no cadastro de itens (`items`) e só usa o
 * enviado como fallback para ids que não existem lá. */
export const autolootItemBulkSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.number().int().positive(),
        name: z.string().min(1).max(255).optional(),
      }),
    )
    .min(1)
    .max(200),
  published: z.boolean().default(true),
});

export type AutolootItemBulkInput = z.infer<typeof autolootItemBulkSchema>;

/** Edição em massa da listagem — campos ausentes ficam como estão. */
export const autolootItemBulkUpdateSchema = z
  .object({
    ids: z.array(z.number().int().positive()).min(1).max(1000),
    category: z.enum(["", ...AUTOLOOT_CATEGORIES]).optional(),
    published: z.boolean().optional(),
  })
  .refine((data) => data.category !== undefined || data.published !== undefined, {
    message: "Informe ao menos um campo para alterar.",
  });

export type AutolootItemBulkUpdateInput = z.infer<typeof autolootItemBulkUpdateSchema>;
