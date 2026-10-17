import { Prisma } from "@/lib/generated/prisma/client";
import type { Item, PrismaClient } from "@/lib/generated/prisma/client";
import type { OtbItemEntry } from "@/lib/items-otb/items-otb-parser";
import { matchLooktypeByClientId } from "@/lib/looktype-lookup";
import {
  ITEM_ABSORB_KEYS,
  ITEM_ELEMENT_KEYS,
  ITEM_FIELD_ABSORB_KEYS,
  ITEM_SKILL_KEYS,
  ITEM_SUPPRESS_KEYS,
  defaultItemField,
  defaultItemFlags,
  type ItemAbsorbKey,
  type ItemElementKey,
  type ItemFieldAbsorbKey,
  type ItemInput,
  type ItemSkillKey,
  type ItemSuppressKey,
} from "@/lib/validations/admin/item";

export function itemFormToRow(input: ItemInput): Prisma.ItemUncheckedCreateInput {
  return {
    id: input.id,
    name: input.name,
    article: input.article,
    plural: input.plural,
    editorSuffix: input.editorSuffix,
    description: input.description,
    clientId: input.clientId,
    lookTypeId: input.lookTypeId,

    type: input.type,
    weaponType: input.weaponType,
    slotType: input.slotType,
    ammoType: input.ammoType,
    ammoAction: input.ammoAction,
    corpseType: input.corpseType,
    shootType: input.shootType,
    effect: input.effect,
    fluidSource: input.fluidSource,
    floorChange: input.floorChange,

    weight: input.weight,
    armor: input.armor,
    defense: input.defense,
    extraDefense: input.extraDefense,
    attack: input.attack,
    extraAttack: input.extraAttack,
    attackSpeed: input.attackSpeed,
    range: input.range,
    hitChance: input.hitChance,
    maxHitChance: input.maxHitChance,
    breakChance: input.breakChance,
    rotateTo: input.rotateTo,
    worth: input.worth,

    containerSize: input.containerSize,
    maxTextLen: input.maxTextLen,
    writeOnceItemId: input.writeOnceItemId,
    readable: input.readable,
    writeable: input.writeable,

    decayTo: input.decayTo,
    duration: input.duration,
    stopDuration: input.stopDuration,
    showDuration: input.showDuration,
    transformEquipTo: input.transformEquipTo,
    transformDeEquipTo: input.transformDeEquipTo,
    transformTo: input.transformTo,
    maleTransformTo: input.maleTransformTo,
    femaleTransformTo: input.femaleTransformTo,
    charges: input.charges,
    showCharges: input.showCharges,
    showAttributes: input.showAttributes,

    lightLevel: input.lightLevel,
    lightColor: input.lightColor,

    speed: input.speed,
    healthGain: input.healthGain,
    healthTicks: input.healthTicks,
    manaGain: input.manaGain,
    manaTicks: input.manaTicks,
    manaShield: input.manaShield,
    soulPoints: input.soulPoints,
    soulPointsPercent: input.soulPointsPercent,
    maxHitPoints: input.maxHitPoints,
    maxHitPointsPercent: input.maxHitPointsPercent,
    maxManaPoints: input.maxManaPoints,
    maxManaPointsPercent: input.maxManaPointsPercent,
    magicLevelPoints: input.magicLevelPoints,
    magicLevelPointsPercent: input.magicLevelPointsPercent,
    increaseMagicValue: input.increaseMagicValue,
    increaseMagicPercent: input.increaseMagicPercent,
    increaseHealingValue: input.increaseHealingValue,
    increaseHealingPercent: input.increaseHealingPercent,

    runeSpellName: input.runeSpellName,

    flags: input.flags as Prisma.InputJsonValue,
    skills: input.skills as Prisma.InputJsonValue,
    elements: input.elements as Prisma.InputJsonValue,
    absorbPercent: input.absorbPercent as Prisma.InputJsonValue,
    fieldAbsorbPercent: input.fieldAbsorbPercent as Prisma.InputJsonValue,
    reflectPercent: input.reflectPercent as Prisma.InputJsonValue,
    reflectChance: input.reflectChance as Prisma.InputJsonValue,
    suppress: input.suppress as Prisma.InputJsonValue,
    field: input.field.enabled ? (input.field as Prisma.InputJsonValue) : Prisma.JsonNull,
    extraAttributes: input.extraAttributes.length
      ? (input.extraAttributes as Prisma.InputJsonValue)
      : Prisma.JsonNull,

    published: input.published,
  };
}

function zeroRecord<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
}

export function itemRowToFormInput(item: Item): ItemInput {
  const skillsRaw = (item.skills ?? {}) as Record<string, number>;
  const elementsRaw = (item.elements ?? {}) as Record<string, number>;
  const absorbRaw = (item.absorbPercent ?? {}) as Record<string, number>;
  const fieldAbsorbRaw = (item.fieldAbsorbPercent ?? {}) as Record<string, number>;
  const reflectPercentRaw = (item.reflectPercent ?? {}) as Record<string, number>;
  const reflectChanceRaw = (item.reflectChance ?? {}) as Record<string, number>;
  const suppressRaw = (item.suppress ?? {}) as Record<string, boolean>;

  return {
    id: item.id,
    name: item.name,
    article: item.article,
    plural: item.plural,
    editorSuffix: item.editorSuffix,
    description: item.description,
    clientId: item.clientId,
    lookTypeId: item.lookTypeId,

    type: item.type as ItemInput["type"],
    weaponType: item.weaponType as ItemInput["weaponType"],
    slotType: item.slotType as ItemInput["slotType"],
    ammoType: item.ammoType,
    ammoAction: item.ammoAction,
    corpseType: item.corpseType,
    shootType: item.shootType,
    effect: item.effect,
    fluidSource: item.fluidSource,
    floorChange: item.floorChange as ItemInput["floorChange"],

    weight: item.weight,
    armor: item.armor,
    defense: item.defense,
    extraDefense: item.extraDefense,
    attack: item.attack,
    extraAttack: item.extraAttack,
    attackSpeed: item.attackSpeed,
    range: item.range,
    hitChance: item.hitChance,
    maxHitChance: item.maxHitChance,
    breakChance: item.breakChance,
    rotateTo: item.rotateTo,
    worth: item.worth,

    containerSize: item.containerSize,
    maxTextLen: item.maxTextLen,
    writeOnceItemId: item.writeOnceItemId,
    readable: item.readable,
    writeable: item.writeable,

    decayTo: item.decayTo,
    duration: item.duration,
    stopDuration: item.stopDuration,
    showDuration: item.showDuration,
    transformEquipTo: item.transformEquipTo,
    transformDeEquipTo: item.transformDeEquipTo,
    transformTo: item.transformTo,
    maleTransformTo: item.maleTransformTo,
    femaleTransformTo: item.femaleTransformTo,
    charges: item.charges,
    showCharges: item.showCharges,
    showAttributes: item.showAttributes,

    lightLevel: item.lightLevel,
    lightColor: item.lightColor,

    speed: item.speed,
    healthGain: item.healthGain,
    healthTicks: item.healthTicks,
    manaGain: item.manaGain,
    manaTicks: item.manaTicks,
    manaShield: item.manaShield,
    soulPoints: item.soulPoints,
    soulPointsPercent: item.soulPointsPercent,
    maxHitPoints: item.maxHitPoints,
    maxHitPointsPercent: item.maxHitPointsPercent,
    maxManaPoints: item.maxManaPoints,
    maxManaPointsPercent: item.maxManaPointsPercent,
    magicLevelPoints: item.magicLevelPoints,
    magicLevelPointsPercent: item.magicLevelPointsPercent,
    increaseMagicValue: item.increaseMagicValue,
    increaseMagicPercent: item.increaseMagicPercent,
    increaseHealingValue: item.increaseHealingValue,
    increaseHealingPercent: item.increaseHealingPercent,

    runeSpellName: item.runeSpellName,

    flags: { ...defaultItemFlags, ...(item.flags as object) },
    skills: {
      ...zeroRecord(ITEM_SKILL_KEYS),
      ...Object.fromEntries(ITEM_SKILL_KEYS.map((key: ItemSkillKey) => [key, skillsRaw[key] ?? 0])),
    },
    elements: {
      ...zeroRecord(ITEM_ELEMENT_KEYS),
      ...Object.fromEntries(ITEM_ELEMENT_KEYS.map((key: ItemElementKey) => [key, elementsRaw[key] ?? 0])),
    },
    absorbPercent: {
      ...zeroRecord(ITEM_ABSORB_KEYS),
      ...Object.fromEntries(ITEM_ABSORB_KEYS.map((key: ItemAbsorbKey) => [key, absorbRaw[key] ?? 0])),
    },
    fieldAbsorbPercent: {
      ...zeroRecord(ITEM_FIELD_ABSORB_KEYS),
      ...Object.fromEntries(
        ITEM_FIELD_ABSORB_KEYS.map((key: ItemFieldAbsorbKey) => [key, fieldAbsorbRaw[key] ?? 0])
      ),
    },
    reflectPercent: {
      ...zeroRecord(ITEM_ABSORB_KEYS),
      ...Object.fromEntries(ITEM_ABSORB_KEYS.map((key: ItemAbsorbKey) => [key, reflectPercentRaw[key] ?? 0])),
    },
    reflectChance: {
      ...zeroRecord(ITEM_ABSORB_KEYS),
      ...Object.fromEntries(ITEM_ABSORB_KEYS.map((key: ItemAbsorbKey) => [key, reflectChanceRaw[key] ?? 0])),
    },
    suppress: Object.fromEntries(
      ITEM_SUPPRESS_KEYS.map((key: ItemSuppressKey) => [key, Boolean(suppressRaw[key])])
    ) as ItemInput["suppress"],
    field: item.field ? { ...defaultItemField, ...(item.field as object), enabled: true } : defaultItemField,
    extraAttributes: (item.extraAttributes as ItemInput["extraAttributes"]) ?? [],

    published: item.published,
  };
}

/** Tamanho de lote para o import em massa — grande o bastante pra não gerar milhares de round-trips,
 * pequeno o bastante pra não estourar o payload de uma única transação/`createMany` no MySQL. */
const IMPORT_CHUNK_SIZE = 300;

/** Lote menor para `update`s em `$transaction` (1 round-trip por linha, colunas JSON grandes). */
const UPDATE_CHUNK_SIZE = 100;

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

/**
 * Import em lote de alta performance para `items.xml` real (~4000+ linhas após expansão de
 * `fromid`/`toid`). Sem `replaceExisting`: upsert por id em lotes de `$transaction` sequenciais
 * (não concorrentes — evita estourar o pool de conexão do MySQL). Com `replaceExisting`: caminho
 * mais rápido de `deleteMany` + `createMany` em lotes (não faz upsert por id nesse caso).
 */
export async function importItemsBatched(
  prismaClient: PrismaClient,
  items: ItemInput[],
  options: { replaceExisting: boolean }
): Promise<{ imported: number }> {
  const batches = chunk(items, IMPORT_CHUNK_SIZE);

  if (options.replaceExisting) {
    await prismaClient.item.deleteMany({});
    for (const batch of batches) {
      await prismaClient.item.createMany({ data: batch.map(itemFormToRow), skipDuplicates: true });
    }
  } else {
    // Uma única consulta pelos ids existentes: os novos entram por `createMany` (1 round-trip por
    // lote) e só os já existentes pagam um `update` — bem menos que um upsert por item.
    const existingIds = new Set(
      (await prismaClient.item.findMany({ select: { id: true } })).map((row) => row.id)
    );
    const toCreate = items.filter((item) => !existingIds.has(item.id));
    const toUpdate = items.filter((item) => existingIds.has(item.id));

    for (const batch of chunk(toCreate, IMPORT_CHUNK_SIZE)) {
      await prismaClient.item.createMany({ data: batch.map(itemFormToRow), skipDuplicates: true });
    }
    for (const batch of chunk(toUpdate, UPDATE_CHUNK_SIZE)) {
      await prismaClient.$transaction(
        batch.map((item) => prismaClient.item.update({ where: { id: item.id }, data: itemFormToRow(item) })),
        { timeout: 60_000 }
      );
    }
  }

  return { imported: items.length };
}

export type OtbSyncResult = {
  clientIdsFilled: number;
  lookTypesLinked: number;
  otbEntriesSkipped: number;
};

/**
 * Aplica o mapeamento server_id/client_id extraído de um `items.otb` (ver
 * `lib/items-otb/items-otb-parser.ts`) sobre os items já cadastrados: preenche `clientId` só
 * onde ainda está vazio (nunca sobrescreve um valor já definido manualmente) e, a partir do
 * `clientId` resultante — recém-preenchido ou já existente —, tenta vincular automaticamente a
 * looktype de item (`category: "item"`) cujo nome contenha esse número, só quando o item ainda
 * não tem nenhuma looktype vinculada. Entradas do `.otb` cujo `serverId` não corresponde a
 * nenhum item cadastrado são apenas contadas, não criam nem apagam nada.
 */
export async function syncItemClientIdsFromOtb(
  prismaClient: PrismaClient,
  otbEntries: OtbItemEntry[]
): Promise<OtbSyncResult> {
  const items = await prismaClient.item.findMany({
    select: { id: true, clientId: true, lookTypeId: true },
  });
  const itemById = new Map(items.map((item) => [item.id, item]));

  // Uma única consulta para todas as looktypes de item — reaproveitada em memória para cada
  // item a vincular, em vez de reconsultar o banco por item (essencial com milhares de items).
  const itemLooktypes = await prismaClient.looktype.findMany({
    where: { category: "item" },
    select: { id: true, name: true },
  });

  const updates = new Map<number, { clientId?: number; lookTypeId?: number }>();
  let clientIdsFilled = 0;
  let lookTypesLinked = 0;
  let otbEntriesSkipped = 0;

  for (const { serverId, clientId } of otbEntries) {
    const item = itemById.get(serverId);
    if (!item) {
      otbEntriesSkipped += 1;
      continue;
    }

    const update: { clientId?: number; lookTypeId?: number } = {};
    const effectiveClientId = item.clientId ?? clientId;

    if (item.clientId == null) {
      update.clientId = clientId;
      clientIdsFilled += 1;
    }

    if (item.lookTypeId == null) {
      const looktype = matchLooktypeByClientId(itemLooktypes, effectiveClientId);
      if (looktype) {
        update.lookTypeId = looktype.id;
        lookTypesLinked += 1;
      }
    }

    if (Object.keys(update).length > 0) updates.set(item.id, update);
  }

  const batches = chunk([...updates.entries()], UPDATE_CHUNK_SIZE);
  for (const batch of batches) {
    await prismaClient.$transaction(
      batch.map(([id, data]) => prismaClient.item.update({ where: { id }, data })),
      { timeout: 60_000 }
    );
  }

  return { clientIdsFilled, lookTypesLinked, otbEntriesSkipped };
}
