import { z } from "zod";

export const MONSTER_BESTIARY_TYPES = ["monster", "boss"] as const;
export type MonsterBestiaryType = (typeof MONSTER_BESTIARY_TYPES)[number];

export const MONSTER_RACES = [
  "venom",
  "blood",
  "undead",
  "fire",
  "energy",
] as const;
export type MonsterRace = (typeof MONSTER_RACES)[number];

/** Cor temática de cada raça — usada na badge da listagem e no select do form, sempre a mesma
 * cor pra reforçar o elemento visualmente (ex.: blood = vermelho, fire = laranja de fogo). */
export const MONSTER_RACE_COLORS: Record<MonsterRace, string> = {
  blood: "#dc2626",
  fire: "#f97316",
  energy: "#a855f7",
  undead: "#65a30d",
  venom: "#22c55e",
};

export const MONSTER_SKULLS = ["none", "yellow", "green", "white", "red", "black"] as const;

/** Opções do select de Caveira (Skull) — `value` é o número salvo no banco e escrito no XML
 * (`<flag skull="X" />`), `label` é só a descrição mostrada no formulário. */
export const MONSTER_SKULL_OPTIONS = [
  { value: "0", label: "Nenhuma" },
  { value: "1", label: "Amarelo" },
  { value: "2", label: "Verde" },
  { value: "3", label: "Branco" },
  { value: "4", label: "Vermelho" },
  { value: "5", label: "Preto" },
] as const;

/** Nomes legados (registros criados antes da mudança pra select numérico) — convertidos pra
 * número na leitura (`monsterRowToFormInput`), pra não perder o valor de monstros já salvos. */
const LEGACY_SKULL_NAME_TO_NUMBER: Record<string, string> = {
  none: "0",
  yellow: "1",
  green: "2",
  white: "3",
  red: "4",
  black: "5",
};

/** Normaliza `flags.skull` vindo do banco — aceita tanto o nome legado ("red") quanto o
 * número já no formato novo ("4") — sempre devolve o número como string. */
export function normalizeSkullValue(value: unknown): string {
  const raw = String(value ?? "0");
  if (raw in LEGACY_SKULL_NAME_TO_NUMBER) return LEGACY_SKULL_NAME_TO_NUMBER[raw];
  return MONSTER_SKULL_OPTIONS.some((option) => option.value === raw) ? raw : "0";
}
export const MONSTER_SHIELDS = [
  "none",
  "whiteyellow",
  "whiteblue",
  "blue",
  "yellow",
  "greenfrozen",
] as const;
export const MONSTER_EMBLEMS = ["none", "green", "red", "blue"] as const;

/** Chaves fixas de `<immunities>`/`<elements>` — valores numéricos (percentual/peso), fiel ao dado real do XML. */
export const IMMUNITY_KEYS = [
  "physical",
  "energy",
  "fire",
  "poison",
  "earth",
  "ice",
  "holy",
  "death",
  "drown",
  "lifedrain",
  "manadrain",
  "outfit",
  "drunk",
  "invisible",
  "paralyze",
] as const;
export type ImmunityKey = (typeof IMMUNITY_KEYS)[number];

export const ELEMENT_KEYS = [
  "firePercent",
  "energyPercent",
  "icePercent",
  "poisonPercent",
  "holyPercent",
  "deathPercent",
  "drownPercent",
  "earthPercent",
  "physicalPercent",
  "lifeDrainPercent",
  "manaDrainPercent",
  "healingPercent",
  "undefinedPercent",
] as const;
export type ElementKey = (typeof ELEMENT_KEYS)[number];

export const attributeEntrySchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});
export type AttributeEntryInput = z.infer<typeof attributeEntrySchema>;

export const monsterFlagsSchema = z.object({
  summonable: z.boolean(),
  attackable: z.boolean(),
  hostile: z.boolean(),
  illusionable: z.boolean(),
  convinceable: z.boolean(),
  pushable: z.boolean(),
  canpushitems: z.boolean(),
  canpushcreatures: z.boolean(),
  hidename: z.boolean(),
  hidehealth: z.boolean(),
  lootmessage: z.number().int(),
  targetdistance: z.number().int(),
  staticattack: z.number().int(),
  lightlevel: z.number().int(),
  lightcolor: z.number().int(),
  runonhealth: z.number().int(),
  lureable: z.boolean(),
  walkable: z.boolean(),
  skull: z.string(),
  shield: z.string(),
  emblem: z.string(),
  canwalkonenergy: z.boolean(),
  canwalkonfire: z.boolean(),
  canwalkonpoison: z.boolean(),
});
export type MonsterFlagsInput = z.infer<typeof monsterFlagsSchema>;

export const monsterSpellSchema = z.object({
  /** Spell vinculada do CRUD de spells (opcional) — quando definida, `name` é preenchido
   * a partir dela; guardada só como referência de conveniência, não afeta o XML exportado. */
  spellId: z.number().int().nullable(),
  name: z.string(),
  script: z.string(),
  interval: z.number().int(),
  chance: z.number().int(),
  range: z.number().int(),
  min: z.number().int(),
  max: z.number().int(),
  length: z.number().int(),
  spread: z.number().int(),
  radius: z.number().int(),
  target: z.boolean(),
  speedchange: z.number().int(),
  duration: z.number().int(),
  attributes: z.array(attributeEntrySchema),
});
export type MonsterSpellInput = z.infer<typeof monsterSpellSchema>;

export const monsterVoiceSchema = z.object({
  sentence: z.string().min(1),
  yell: z.boolean(),
});
export type MonsterVoiceInput = z.infer<typeof monsterVoiceSchema>;

export const monsterSummonSchema = z.object({
  name: z.string().min(1),
  interval: z.number().int(),
  chance: z.number().int(),
  amount: z.number().int(),
});
export type MonsterSummonInput = z.infer<typeof monsterSummonSchema>;

/** `chance` do XML vai de 0 a `LOOT_CHANCE_MAX` (100000 = 100% de drop). */
export const LOOT_CHANCE_MAX = 100000;

/** Converte o `chance` bruto do XML (0-100000) para porcentagem (0-100). */
export function lootChanceToPercent(rawChance: number): number {
  return rawChance / (LOOT_CHANCE_MAX / 100);
}

/** Converte a porcentagem informada no formulário (0-100) para o `chance` bruto do XML. */
export function lootChancePercentToRaw(percent: number): number {
  return Math.round(percent * (LOOT_CHANCE_MAX / 100));
}

export type MonsterLootItemInput = {
  id: number;
  count: number;
  /** Porcentagem (0-100) exibida/editada no formulário — convertida para o `chance` (0-100000) do XML na exportação. */
  chance: number;
  subtype: number | null;
  actionId: number | null;
  uniqueId: number | null;
  text: string;
  comment: string;
  /** Se marcado, o item é publicado/mantido no catálogo de autoloot (`AutolootItem`) ao salvar o monstro. */
  addToAutoloot: boolean;
  children: MonsterLootItemInput[];
};

export const monsterLootItemSchema: z.ZodType<MonsterLootItemInput, MonsterLootItemInput> = z.lazy(() =>
  z.object({
    id: z.number().int(),
    count: z.number().int(),
    chance: z.number().min(0).max(100),
    subtype: z.number().int().nullable(),
    actionId: z.number().int().nullable(),
    uniqueId: z.number().int().nullable(),
    text: z.string(),
    comment: z.string(),
    addToAutoloot: z.boolean(),
    children: z.array(monsterLootItemSchema),
  })
);

export const monsterFormSchema = z.object({
  name: z.string().min(1, "Informe o nome").max(255),
  nameDescription: z.string().max(255),
  bestiary: z.string().min(1).max(50),
  category: z.string().max(100),
  subcategory: z.string().max(100),
  race: z.string().min(1).max(20),
  experience: z.number().int().min(0),
  speed: z.number().int().min(0),
  manacost: z.number().int().min(0),

  healthNow: z.number().int().min(0),
  healthMax: z.number().int().min(1),

  lookTypeEx: z.number().int().nullable(),
  lookHead: z.number().int(),
  lookBody: z.number().int(),
  lookLegs: z.number().int(),
  lookFeet: z.number().int(),
  lookAddons: z.number().int(),
  corpse: z.number().int(),
  /** Sprite vinculada do cadastro de looktypes — fonte do `look type="xx"` no XML e da
   * thumbnail animada (substitui o antigo campo `lookType` livre). */
  lookTypeId: z.number().int().nullable(),
  /** Universo genérico (CRUD de Sistema, compartilhado com Vocação). */
  universeId: z.number().int().nullable(),

  targetChangeInterval: z.number().int().min(1),
  targetChangeChance: z.number().int().min(0).max(100),

  strategyAttack: z.number().int().nullable(),
  strategyDefense: z.number().int().nullable(),

  flags: monsterFlagsSchema,
  attacks: z.array(monsterSpellSchema),
  defenseArmor: z.number().int(),
  defenseValue: z.number().int(),
  defenses: z.array(monsterSpellSchema),
  immunities: z.record(z.enum(IMMUNITY_KEYS), z.number().int()),
  elements: z.record(z.enum(ELEMENT_KEYS), z.number().int()),
  voiceInterval: z.number().int(),
  voiceChance: z.number().int(),
  voices: z.array(monsterVoiceSchema),
  loot: z.array(monsterLootItemSchema),
  maxSummons: z.number().int(),
  summons: z.array(monsterSummonSchema),
  script: z.array(z.string().min(1)),
  /** Spells vinculadas ao monstro (`MonsterSpell`) — espelha `<monster name="X"/>` dentro
   * de `<instant>` no spells.xml, independente das listas de attacks/defenses. */
  linkedSpellIds: z.array(z.number().int()),

  published: z.boolean(),
});

export type MonsterFormInput = z.infer<typeof monsterFormSchema>;

export const defaultMonsterFlags: MonsterFlagsInput = {
  summonable: false,
  attackable: true,
  hostile: true,
  illusionable: false,
  convinceable: false,
  pushable: true,
  canpushitems: false,
  canpushcreatures: false,
  hidename: false,
  hidehealth: false,
  lootmessage: 0,
  targetdistance: 1,
  staticattack: 95,
  lightlevel: 0,
  lightcolor: 0,
  runonhealth: 0,
  lureable: false,
  walkable: false,
  skull: "0",
  shield: "none",
  emblem: "none",
  canwalkonenergy: false,
  canwalkonfire: false,
  canwalkonpoison: false,
};

export const emptyMonsterSpell: MonsterSpellInput = {
  spellId: null,
  name: "melee",
  script: "",
  interval: 2000,
  chance: 100,
  range: 0,
  min: 0,
  max: 0,
  length: 0,
  spread: 0,
  radius: 0,
  target: false,
  speedchange: 0,
  duration: 0,
  attributes: [],
};

export const emptyMonsterVoice: MonsterVoiceInput = { sentence: "", yell: false };
export const emptyMonsterSummon: MonsterSummonInput = {
  name: "",
  interval: 2000,
  chance: 100,
  amount: 1,
};
export const emptyMonsterLootItem: MonsterLootItemInput = {
  id: 0,
  count: 1,
  chance: 100,
  subtype: null,
  actionId: null,
  uniqueId: null,
  text: "",
  comment: "",
  addToAutoloot: false,
  children: [],
};

function zeroRecord<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
}

export const defaultMonsterValues: MonsterFormInput = {
  name: "",
  nameDescription: "",
  bestiary: "monster",
  category: "",
  subcategory: "",
  race: "blood",
  experience: 0,
  speed: 200,
  manacost: 0,

  healthNow: 100,
  healthMax: 100,

  lookTypeEx: null,
  lookTypeId: null,
  universeId: null,
  lookHead: 0,
  lookBody: 0,
  lookLegs: 0,
  lookFeet: 0,
  lookAddons: 0,
  corpse: 0,

  targetChangeInterval: 4000,
  targetChangeChance: 10,

  strategyAttack: null,
  strategyDefense: null,

  flags: defaultMonsterFlags,
  attacks: [],
  defenseArmor: 0,
  defenseValue: 0,
  defenses: [],
  immunities: zeroRecord(IMMUNITY_KEYS),
  elements: zeroRecord(ELEMENT_KEYS),
  voiceInterval: 5000,
  voiceChance: 10,
  voices: [],
  loot: [],
  maxSummons: 0,
  summons: [],
  script: [],
  linkedSpellIds: [],

  published: false,
};
