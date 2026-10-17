import type { Monster, Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import {
  ELEMENT_KEYS,
  IMMUNITY_KEYS,
  defaultMonsterFlags,
  normalizeSkullValue,
  type ElementKey,
  type ImmunityKey,
  type MonsterFormInput,
  type MonsterLootItemInput,
} from "@/lib/validations/admin/monster";

/** Preenche `addToAutoloot` (campo novo) com `false` em itens de loot salvos antes dele existir. */
function normalizeLootItems(items: MonsterLootItemInput[] | undefined | null): MonsterLootItemInput[] {
  return (items ?? []).map((item) => ({
    ...item,
    addToAutoloot: item.addToAutoloot ?? false,
    children: normalizeLootItems(item.children),
  }));
}

/** Ids de spell vinculados nos attacks/defenses (para resolver `words` na exportação XML). */
export function spellIdsFromMonsterFormInput(input: Pick<MonsterFormInput, "attacks" | "defenses">): number[] {
  const ids = [...input.attacks, ...input.defenses]
    .map((spell) => spell.spellId)
    .filter((id): id is number => id != null);
  return Array.from(new Set(ids));
}

/** Busca as `words` das spells vinculadas aos attacks/defenses do monstro — usadas para
 * resolver o `name` efetivo no XML exportado (ver `resolveSpellName` em `monster-xml.ts`). */
export async function fetchWordsBySpellId(
  prisma: PrismaClient,
  input: Pick<MonsterFormInput, "attacks" | "defenses">
): Promise<Record<number, string>> {
  const spellIds = spellIdsFromMonsterFormInput(input);
  if (spellIds.length === 0) return {};

  const spells = await prisma.spell.findMany({
    where: { id: { in: spellIds } },
    select: { id: true, words: true },
  });

  return Object.fromEntries(spells.map((spell) => [spell.id, spell.words]));
}

export function monsterFormToRow(input: MonsterFormInput) {
  return {
    name: input.name,
    nameDescription: input.nameDescription,
    bestiary: input.bestiary,
    category: input.category,
    subcategory: input.subcategory,
    race: input.race,
    experience: input.experience,
    speed: input.speed,
    manacost: input.manacost,
    healthNow: BigInt(input.healthNow),
    healthMax: BigInt(input.healthMax),
    // `lookType` (outfit real do XML) é derivado da sprite vinculada — o cadastro da
    // looktype (`lookTypeId`) É o número usado em `look type="xx"`.
    lookType: input.lookTypeId,
    lookTypeEx: input.lookTypeEx,
    lookTypeId: input.lookTypeId,
    universeId: input.universeId,
    lookHead: input.lookHead,
    lookBody: input.lookBody,
    lookLegs: input.lookLegs,
    lookFeet: input.lookFeet,
    lookAddons: input.lookAddons,
    corpse: input.corpse,
    targetChangeInterval: input.targetChangeInterval,
    targetChangeChance: input.targetChangeChance,
    strategyAttack: input.strategyAttack,
    strategyDefense: input.strategyDefense,
    flags: input.flags as Prisma.InputJsonValue,
    attacks: input.attacks as Prisma.InputJsonValue,
    defenses: { armor: input.defenseArmor, defense: input.defenseValue, list: input.defenses } as Prisma.InputJsonValue,
    immunities: input.immunities as Prisma.InputJsonValue,
    elements: input.elements as Prisma.InputJsonValue,
    voices: { interval: input.voiceInterval, chance: input.voiceChance, list: input.voices } as Prisma.InputJsonValue,
    loot: input.loot as Prisma.InputJsonValue,
    summons: { maxSummons: input.maxSummons, list: input.summons } as Prisma.InputJsonValue,
    script: input.script as Prisma.InputJsonValue,
    published: input.published,
  };
}

function zeroRecord<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
}

export function monsterRowToFormInput(
  monster: Monster & { spells?: { spellId: number }[] }
): MonsterFormInput {
  const defenses = (monster.defenses ?? {}) as { armor?: number; defense?: number; list?: unknown[] };
  const voices = (monster.voices ?? {}) as { interval?: number; chance?: number; list?: unknown[] };
  const summons = (monster.summons ?? {}) as { maxSummons?: number; list?: unknown[] };
  const immunitiesRaw = (monster.immunities ?? {}) as Record<string, number>;
  const elementsRaw = (monster.elements ?? {}) as Record<string, number>;

  return {
    name: monster.name,
    nameDescription: monster.nameDescription,
    bestiary: monster.bestiary,
    category: monster.category,
    subcategory: monster.subcategory,
    race: monster.race,
    experience: monster.experience,
    speed: monster.speed,
    manacost: monster.manacost,
    healthNow: Number(monster.healthNow),
    healthMax: Number(monster.healthMax),
    lookTypeEx: monster.lookTypeEx,
    lookTypeId: monster.lookTypeId,
    universeId: monster.universeId,
    lookHead: monster.lookHead,
    lookBody: monster.lookBody,
    lookLegs: monster.lookLegs,
    lookFeet: monster.lookFeet,
    lookAddons: monster.lookAddons,
    corpse: monster.corpse,
    targetChangeInterval: monster.targetChangeInterval,
    targetChangeChance: monster.targetChangeChance,
    strategyAttack: monster.strategyAttack,
    strategyDefense: monster.strategyDefense,
    flags: {
      ...defaultMonsterFlags,
      ...(monster.flags as object),
      skull: normalizeSkullValue((monster.flags as { skull?: unknown } | null)?.skull),
    },
    attacks: (monster.attacks as MonsterFormInput["attacks"]) ?? [],
    defenseArmor: defenses.armor ?? 0,
    defenseValue: defenses.defense ?? 0,
    defenses: (defenses.list as MonsterFormInput["defenses"]) ?? [],
    immunities: {
      ...zeroRecord(IMMUNITY_KEYS),
      ...Object.fromEntries(IMMUNITY_KEYS.map((key: ImmunityKey) => [key, immunitiesRaw[key] ?? 0])),
    },
    elements: {
      ...zeroRecord(ELEMENT_KEYS),
      ...Object.fromEntries(ELEMENT_KEYS.map((key: ElementKey) => [key, elementsRaw[key] ?? 0])),
    },
    voiceInterval: voices.interval ?? 5000,
    voiceChance: voices.chance ?? 0,
    voices: (voices.list as MonsterFormInput["voices"]) ?? [],
    loot: normalizeLootItems(monster.loot as MonsterFormInput["loot"]),
    maxSummons: summons.maxSummons ?? 0,
    summons: (summons.list as MonsterFormInput["summons"]) ?? [],
    script: (monster.script as string[]) ?? [],
    linkedSpellIds: (monster.spells ?? []).map((link) => link.spellId),
    published: monster.published,
  };
}
