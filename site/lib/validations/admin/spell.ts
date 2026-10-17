import { z } from "zod";

export const SPELL_KINDS = ["instant", "rune", "conjure"] as const;
export type SpellKind = (typeof SPELL_KINDS)[number];

/** Espelha `blocktype` do `Spell::configureSpell` (spells.cpp) — "" = não emite o atributo. */
export const BLOCK_TYPES = ["", "all", "solid", "creature"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

/** Taxonomia própria do portal para o campo `group` (o atributo é decorativo na engine —
 * `TalkAction::configureEvent` só usa `group`/`groups` para IDs numéricos de acesso, não para
 * essa categorização). Armazenado em `Spell.group` como string separada por vírgula.
 * Valores em inglês minúsculo — mesma convenção usada em `group="..."` no `spells.xml` real do
 * servidor (ex.: `group="attacks"`, `group="healing,support"`). Salvar rótulos em português
 * (ex.: "Suporte") não quebra a engine (o atributo é inerte), mas diverge do padrão real e
 * atrapalha qualquer script/tooling que faça grep por `group="..."`. */
export const SPELL_GROUP_OPTIONS = [
  "attacks",
  "healing",
  "support",
  "buffs",
  "monsters",
] as const;
export type SpellGroupOption = (typeof SPELL_GROUP_OPTIONS)[number];

export const spellVocationSchema = z.object({
  vocationId: z.number().int(),
  /** Espelha o atributo opcional `showInDescription` de `<vocation>` (default true no XML). */
  showInDescription: z.boolean(),
});
export type SpellVocationInput = z.infer<typeof spellVocationSchema>;

const baseSpellFormSchema = z.object({
  kind: z.enum(SPELL_KINDS),
  name: z.string().min(1, "Informe o nome").max(255),
  /** Sprite vinculada do cadastro de looktypes — só para thumbnail animada do portal. */
  lookTypeId: z.number().int().nullable(),
  words: z.string().max(255),
  runeItemId: z.number().int().nullable(),
  level: z.number().int(),
  magicLevel: z.number().int(),
  mana: z.number().int(),
  manaPercent: z.number().int(),
  soul: z.number().int(),
  exhaustion: z.number().int(),
  enabled: z.boolean(),
  premium: z.boolean(),
  needTarget: z.boolean(),
  needWeapon: z.boolean(),
  selfTarget: z.boolean(),
  needLearn: z.boolean(),
  range: z.number().int(),
  blockType: z.enum(BLOCK_TYPES),
  aggressive: z.boolean(),
  blockWalls: z.boolean(),
  allowFarUse: z.boolean(),
  hasParam: z.boolean(),
  needDirection: z.boolean(),
  casterTargetOrDirection: z.boolean(),
  limitRange: z.number().int(),
  hasCharges: z.boolean(),
  conjureId: z.number().int().nullable(),
  conjureCount: z.number().int().nullable(),
  conjureReagentId: z.number().int().nullable(),
  event: z.string().max(20),
  scriptValue: z.string().max(255),
  functionName: z.string().max(50),
  description: z.string().max(255),
  group: z.string().max(50),
  vocations: z.array(spellVocationSchema),
  published: z.boolean(),
});

export type SpellFormInput = z.infer<typeof baseSpellFormSchema>;

export const spellFormSchema = baseSpellFormSchema
  .refine((data) => data.kind !== "rune" || data.runeItemId != null, {
    message: "Informe o id do item da rune",
    path: ["runeItemId"],
  })
  .refine((data) => data.kind === "rune" || data.words.trim().length > 0, {
    message: "Informe as palavras mágicas",
    path: ["words"],
  })
  .refine((data) => data.kind !== "conjure" || data.conjureId != null, {
    message: "Informe o id do item conjurado",
    path: ["conjureId"],
  });

export const defaultSpellValues: SpellFormInput = {
  kind: "instant",
  name: "",
  lookTypeId: null,
  words: "",
  runeItemId: null,
  level: 0,
  magicLevel: 0,
  mana: 0,
  manaPercent: 0,
  soul: 0,
  exhaustion: 0,
  enabled: true,
  premium: false,
  needTarget: false,
  needWeapon: false,
  selfTarget: false,
  needLearn: false,
  range: 0,
  blockType: "",
  aggressive: false,
  blockWalls: false,
  allowFarUse: false,
  hasParam: false,
  needDirection: false,
  casterTargetOrDirection: false,
  limitRange: 0,
  hasCharges: false,
  conjureId: null,
  conjureCount: null,
  conjureReagentId: null,
  event: "script",
  scriptValue: "",
  functionName: "",
  description: "",
  group: "",
  vocations: [],
  published: false,
};

export const emptySpellVocation: SpellVocationInput = { vocationId: 0, showInDescription: true };
