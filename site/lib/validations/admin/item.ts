import { z } from "zod";

export const ITEM_TYPES = [
  "",
  "container",
  "key",
  "magicfield",
  "depot",
  "mailbox",
  "trashholder",
  "teleport",
  "door",
  "bed",
  "rune",
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const WEAPON_TYPES = [
  "",
  "sword",
  "club",
  "axe",
  "shield",
  "distance",
  "wand",
  "ammunition",
  "fist",
] as const;
export type WeaponType = (typeof WEAPON_TYPES)[number];

export const SLOT_TYPES = [
  "",
  "head",
  "body",
  "legs",
  "feet",
  "backpack",
  "two-handed",
  "necklace",
  "ring",
  "ammo",
  "hand",
] as const;
export type SlotType = (typeof SLOT_TYPES)[number];

export const FLOOR_CHANGES = [
  "",
  "down",
  "north",
  "south",
  "west",
  "east",
  "northex",
  "southex",
  "westex",
  "eastex",
] as const;
export type FloorChange = (typeof FLOOR_CHANGES)[number];

/** Tipos aceitos pelo bloco `<attribute key="field" value="...">` (magicfield). */
export const FIELD_TYPES = [
  "fire",
  "energy",
  "earth",
  "poison",
  "ice",
  "freezing",
  "holy",
  "dazzled",
  "death",
  "cursed",
  "drown",
  "physical",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/** Chaves dos danos elementais de arma (`<attribute key="element{Suffix}">`). */
export const ITEM_ELEMENT_KEYS = [
  "physical",
  "fire",
  "energy",
  "earth",
  "ice",
  "holy",
  "death",
  "lifeDrain",
  "manaDrain",
  "healing",
  "undefined",
] as const;
export type ItemElementKey = (typeof ITEM_ELEMENT_KEYS)[number];

/** Chaves usadas por absorbPercent/reflectPercent/reflectChance — os elementos + drown/magic/all. */
export const ITEM_ABSORB_KEYS = [...ITEM_ELEMENT_KEYS, "drown", "magic", "all"] as const;
export type ItemAbsorbKey = (typeof ITEM_ABSORB_KEYS)[number];

export const ITEM_FIELD_ABSORB_KEYS = ["fire", "energy", "earth"] as const;
export type ItemFieldAbsorbKey = (typeof ITEM_FIELD_ABSORB_KEYS)[number];

export const ITEM_SKILL_KEYS = ["sword", "axe", "club", "distance", "shielding", "fishing", "fist"] as const;
export type ItemSkillKey = (typeof ITEM_SKILL_KEYS)[number];

/** Chaves canônicas das ~25 imunidades de condição (`<attribute key="suppress{Suffix}">`). */
export const ITEM_SUPPRESS_KEYS = [
  "energy",
  "fire",
  "earth",
  "ice",
  "holy",
  "death",
  "drown",
  "physical",
  "haste",
  "paralyze",
  "drunk",
  "regeneration",
  "soul",
  "outfit",
  "invisible",
  "inFight",
  "exhaustion",
  "muted",
  "pacified",
  "light",
  "attributes",
  "manaShield",
  "lifeDrain",
] as const;
export type ItemSuppressKey = (typeof ITEM_SUPPRESS_KEYS)[number];

export const itemFlagsSchema = z.object({
  blocking: z.boolean(),
  blockProjectile: z.boolean(),
  blockPathfind: z.boolean(),
  movable: z.boolean(),
  pickupable: z.boolean(),
  allowPickupable: z.boolean(),
  showCount: z.boolean(),
  dualWield: z.boolean(),
  preventLoss: z.boolean(),
  preventDrop: z.boolean(),
  invisible: z.boolean(),
  forceSerialize: z.boolean(),
  replacable: z.boolean(),
  walkStack: z.boolean(),
  rotable: z.boolean(),
  canReadText: z.boolean(),
  allowDistRead: z.boolean(),
});
export type ItemFlagsInput = z.infer<typeof itemFlagsSchema>;

export const attributeEntrySchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});
export type ItemAttributeEntryInput = z.infer<typeof attributeEntrySchema>;

export const itemFieldDamageSchema = z.object({
  start: z.number().int().nullable(),
  damage: z.number().int(),
});
export type ItemFieldDamageInput = z.infer<typeof itemFieldDamageSchema>;

export const itemFieldSchema = z.object({
  enabled: z.boolean(),
  value: z.enum(FIELD_TYPES),
  ticks: z.number().int(),
  count: z.number().int(),
  start: z.number().int(),
  damages: z.array(itemFieldDamageSchema),
});
export type ItemFieldInput = z.infer<typeof itemFieldSchema>;

function numberRecord<K extends string>(keys: readonly K[]) {
  return z.object(Object.fromEntries(keys.map((key) => [key, z.number().int()])) as Record<K, z.ZodNumber>);
}

function booleanRecord<K extends string>(keys: readonly K[]) {
  return z.object(Object.fromEntries(keys.map((key) => [key, z.boolean()])) as Record<K, z.ZodBoolean>);
}

export const itemSkillsSchema = numberRecord(ITEM_SKILL_KEYS);
export type ItemSkillsInput = z.infer<typeof itemSkillsSchema>;

export const itemElementsSchema = numberRecord(ITEM_ELEMENT_KEYS);
export type ItemElementsInput = z.infer<typeof itemElementsSchema>;

export const itemAbsorbSchema = numberRecord(ITEM_ABSORB_KEYS);
export type ItemAbsorbInput = z.infer<typeof itemAbsorbSchema>;

export const itemFieldAbsorbSchema = numberRecord(ITEM_FIELD_ABSORB_KEYS);
export type ItemFieldAbsorbInput = z.infer<typeof itemFieldAbsorbSchema>;

export const itemSuppressSchema = booleanRecord(ITEM_SUPPRESS_KEYS);
export type ItemSuppressInput = z.infer<typeof itemSuppressSchema>;

export const itemSchema = z.object({
  id: z.number().int().min(1, "Informe o id do item"),
  name: z.string().min(1, "Informe o nome").max(255),
  article: z.string().max(10),
  plural: z.string().max(255),
  editorSuffix: z.string().max(100),
  description: z.string().max(255),
  /** Client id real do sprite no `.otb`/items.xml — usado para localizar a looktype
   * correspondente (nome no padrão `item_{clientId}`) e persistido no `items.xml`. */
  clientId: z.number().int().min(1).nullable(),
  /** Sprite vinculada do cadastro de looktypes (/admin/looktypes) — auto-preenchida a partir do
   * `clientId` quando existe uma looktype com esse número no nome; editável manualmente. */
  lookTypeId: z.number().int().nullable(),

  type: z.enum(ITEM_TYPES),
  weaponType: z.enum(WEAPON_TYPES),
  slotType: z.enum(SLOT_TYPES),
  ammoType: z.string().max(20),
  ammoAction: z.string().max(20),
  corpseType: z.string().max(20),
  shootType: z.string().max(30),
  effect: z.string().max(30),
  fluidSource: z.string().max(20),
  floorChange: z.enum(FLOOR_CHANGES),

  weight: z.number().int(),
  armor: z.number().int(),
  defense: z.number().int(),
  extraDefense: z.number().int(),
  attack: z.number().int(),
  extraAttack: z.number().int(),
  attackSpeed: z.number().int(),
  range: z.number().int(),
  hitChance: z.number().int(),
  maxHitChance: z.number().int(),
  breakChance: z.number().int(),
  rotateTo: z.number().int().nullable(),
  worth: z.number().int(),

  containerSize: z.number().int(),
  maxTextLen: z.number().int(),
  writeOnceItemId: z.number().int().nullable(),
  readable: z.boolean(),
  writeable: z.boolean(),

  decayTo: z.number().int().nullable(),
  duration: z.number().int(),
  stopDuration: z.boolean(),
  showDuration: z.boolean(),
  transformEquipTo: z.number().int().nullable(),
  transformDeEquipTo: z.number().int().nullable(),
  transformTo: z.number().int().nullable(),
  maleTransformTo: z.number().int().nullable(),
  femaleTransformTo: z.number().int().nullable(),
  charges: z.number().int(),
  showCharges: z.boolean(),
  showAttributes: z.boolean(),

  lightLevel: z.number().int(),
  lightColor: z.number().int(),

  speed: z.number().int(),
  healthGain: z.number().int(),
  healthTicks: z.number().int(),
  manaGain: z.number().int(),
  manaTicks: z.number().int(),
  manaShield: z.boolean(),
  soulPoints: z.number().int(),
  soulPointsPercent: z.number().int(),
  maxHitPoints: z.number().int(),
  maxHitPointsPercent: z.number().int(),
  maxManaPoints: z.number().int(),
  maxManaPointsPercent: z.number().int(),
  magicLevelPoints: z.number().int(),
  magicLevelPointsPercent: z.number().int(),
  increaseMagicValue: z.number().int(),
  increaseMagicPercent: z.number().int(),
  increaseHealingValue: z.number().int(),
  increaseHealingPercent: z.number().int(),

  runeSpellName: z.string().max(255),

  flags: itemFlagsSchema,
  skills: itemSkillsSchema,
  elements: itemElementsSchema,
  absorbPercent: itemAbsorbSchema,
  fieldAbsorbPercent: itemFieldAbsorbSchema,
  reflectPercent: itemAbsorbSchema,
  reflectChance: itemAbsorbSchema,
  suppress: itemSuppressSchema,
  field: itemFieldSchema,
  extraAttributes: z.array(attributeEntrySchema),

  published: z.boolean(),
});

export type ItemInput = z.infer<typeof itemSchema>;

function zeroRecord<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
}

function falseRecord<K extends string>(keys: readonly K[]): Record<K, boolean> {
  return Object.fromEntries(keys.map((key) => [key, false])) as Record<K, boolean>;
}

export const defaultItemFlags: ItemFlagsInput = {
  blocking: false,
  blockProjectile: false,
  blockPathfind: false,
  movable: true,
  pickupable: true,
  allowPickupable: false,
  showCount: true,
  dualWield: false,
  preventLoss: false,
  preventDrop: false,
  invisible: false,
  forceSerialize: false,
  replacable: true,
  walkStack: true,
  rotable: false,
  canReadText: false,
  allowDistRead: false,
};

export const defaultItemField: ItemFieldInput = {
  enabled: false,
  value: "fire",
  ticks: 0,
  count: 0,
  start: 0,
  damages: [],
};

export const emptyFieldDamage: ItemFieldDamageInput = { start: null, damage: 0 };

export const defaultItemValues: ItemInput = {
  id: 0,
  name: "",
  article: "",
  plural: "",
  editorSuffix: "",
  description: "",
  clientId: null,
  lookTypeId: null,

  type: "",
  weaponType: "",
  slotType: "",
  ammoType: "",
  ammoAction: "",
  corpseType: "",
  shootType: "",
  effect: "",
  fluidSource: "",
  floorChange: "",

  weight: 0,
  armor: 0,
  defense: 0,
  extraDefense: 0,
  attack: 0,
  extraAttack: 0,
  attackSpeed: 0,
  range: 0,
  hitChance: 0,
  maxHitChance: 0,
  breakChance: 0,
  rotateTo: null,
  worth: 0,

  containerSize: 0,
  maxTextLen: 0,
  writeOnceItemId: null,
  readable: false,
  writeable: false,

  decayTo: null,
  duration: 0,
  stopDuration: false,
  showDuration: false,
  transformEquipTo: null,
  transformDeEquipTo: null,
  transformTo: null,
  maleTransformTo: null,
  femaleTransformTo: null,
  charges: 0,
  showCharges: false,
  showAttributes: false,

  lightLevel: 0,
  lightColor: 0,

  speed: 0,
  healthGain: 0,
  healthTicks: 0,
  manaGain: 0,
  manaTicks: 0,
  manaShield: false,
  soulPoints: 0,
  soulPointsPercent: 0,
  maxHitPoints: 0,
  maxHitPointsPercent: 0,
  maxManaPoints: 0,
  maxManaPointsPercent: 0,
  magicLevelPoints: 0,
  magicLevelPointsPercent: 0,
  increaseMagicValue: 0,
  increaseMagicPercent: 0,
  increaseHealingValue: 0,
  increaseHealingPercent: 0,

  runeSpellName: "",

  flags: defaultItemFlags,
  skills: zeroRecord(ITEM_SKILL_KEYS),
  elements: zeroRecord(ITEM_ELEMENT_KEYS),
  absorbPercent: zeroRecord(ITEM_ABSORB_KEYS),
  fieldAbsorbPercent: zeroRecord(ITEM_FIELD_ABSORB_KEYS),
  reflectPercent: zeroRecord(ITEM_ABSORB_KEYS),
  reflectChance: zeroRecord(ITEM_ABSORB_KEYS),
  suppress: falseRecord(ITEM_SUPPRESS_KEYS),
  field: defaultItemField,
  extraAttributes: [],

  published: false,
};
