import {
  ITEM_ABSORB_KEYS,
  ITEM_ELEMENT_KEYS,
  ITEM_FIELD_ABSORB_KEYS,
  ITEM_SKILL_KEYS,
  ITEM_SUPPRESS_KEYS,
  type ItemAbsorbKey,
  type ItemElementKey,
  type ItemInput,
  type ItemSkillKey,
  type ItemSuppressKey,
} from "@/lib/validations/admin/item";
import { escapeXml, indent } from "@/lib/xml-utils";

/** Sufixo do nome de atributo XML (`element{Suffix}`, `absorbPercent{Suffix}`, ...) por chave canônica. */
const ELEMENT_SUFFIX: Record<ItemElementKey, string> = {
  physical: "Physical",
  fire: "Fire",
  energy: "Energy",
  earth: "Earth",
  ice: "Ice",
  holy: "Holy",
  death: "Death",
  lifeDrain: "LifeDrain",
  manaDrain: "ManaDrain",
  healing: "Healing",
  undefined: "Undefined",
};

const ABSORB_EXTRA_SUFFIX: Record<"drown" | "magic" | "all", string> = {
  drown: "Drown",
  magic: "Magic",
  all: "All",
};

const ABSORB_SUFFIX: Record<ItemAbsorbKey, string> = { ...ELEMENT_SUFFIX, ...ABSORB_EXTRA_SUFFIX };

const SUPPRESS_SUFFIX: Record<ItemSuppressKey, string> = {
  energy: "Energy",
  fire: "Fire",
  earth: "Earth",
  ice: "Ice",
  holy: "Holy",
  death: "Death",
  drown: "Drown",
  physical: "Physical",
  haste: "Haste",
  paralyze: "Paralyze",
  drunk: "Drunk",
  regeneration: "Regeneration",
  soul: "Soul",
  outfit: "Outfit",
  invisible: "Invisible",
  inFight: "InFight",
  exhaustion: "Exhaust",
  muted: "Muted",
  pacified: "Pacified",
  light: "Light",
  attributes: "Attributes",
  manaShield: "ManaShield",
  lifeDrain: "LifeDrain",
};

const SKILL_SUFFIX: Record<ItemSkillKey, string> = {
  sword: "Sword",
  axe: "Axe",
  club: "Club",
  distance: "Dist",
  shielding: "Shield",
  fishing: "Fish",
  fist: "Fist",
};

function pushNum(lines: string[], key: string, value: number, defaultValue = 0) {
  if (value !== defaultValue) lines.push(`<attribute key="${key}" value="${value}" />`);
}

function pushBool(lines: string[], key: string, value: boolean, defaultValue = false) {
  if (value !== defaultValue) lines.push(`<attribute key="${key}" value="${value ? 1 : 0}" />`);
}

function pushStr(lines: string[], key: string, value: string) {
  if (value) lines.push(`<attribute key="${key}" value="${escapeXml(value)}" />`);
}

export function itemToXml(item: ItemInput): string {
  const rootAttrs = [`id="${item.id}"`];
  if (item.clientId != null) rootAttrs.push(`client_id="${item.clientId}"`);
  if (item.article) rootAttrs.push(`article="${escapeXml(item.article)}"`);
  rootAttrs.push(`name="${escapeXml(item.name)}"`);
  if (item.plural) rootAttrs.push(`plural="${escapeXml(item.plural)}"`);
  if (item.editorSuffix) rootAttrs.push(`editorsuffix="${escapeXml(item.editorSuffix)}"`);

  const attrs: string[] = [];

  pushStr(attrs, "type", item.type);
  pushStr(attrs, "weaponType", item.weaponType);
  pushStr(attrs, "slotType", item.slotType);
  pushStr(attrs, "ammoType", item.ammoType);
  pushStr(attrs, "ammoAction", item.ammoAction);
  pushStr(attrs, "corpseType", item.corpseType);
  pushStr(attrs, "shootType", item.shootType);
  pushStr(attrs, "effect", item.effect);
  pushStr(attrs, "fluidSource", item.fluidSource);
  pushStr(attrs, "floorchange", item.floorChange);
  pushStr(attrs, "description", item.description);

  pushNum(attrs, "weight", item.weight);
  pushNum(attrs, "armor", item.armor);
  pushNum(attrs, "defense", item.defense);
  pushNum(attrs, "extraDefense", item.extraDefense);
  pushNum(attrs, "attack", item.attack);
  pushNum(attrs, "extraAttack", item.extraAttack);
  pushNum(attrs, "attackSpeed", item.attackSpeed);
  pushNum(attrs, "range", item.range);
  pushNum(attrs, "hitChance", item.hitChance);
  pushNum(attrs, "maxHitChance", item.maxHitChance);
  pushNum(attrs, "breakChance", item.breakChance);
  if (item.rotateTo != null) pushNum(attrs, "rotateTo", item.rotateTo, Number.NaN);
  pushNum(attrs, "worth", item.worth);

  pushNum(attrs, "containerSize", item.containerSize);
  pushNum(attrs, "maxTextLen", item.maxTextLen);
  if (item.writeOnceItemId != null) pushNum(attrs, "writeOnceItemId", item.writeOnceItemId, Number.NaN);
  pushBool(attrs, "readable", item.readable);
  pushBool(attrs, "writeable", item.writeable);

  if (item.decayTo != null) pushNum(attrs, "decayTo", item.decayTo, Number.NaN);
  pushNum(attrs, "duration", item.duration);
  pushBool(attrs, "stopDuration", item.stopDuration);
  pushBool(attrs, "showDuration", item.showDuration);
  if (item.transformEquipTo != null) pushNum(attrs, "transformEquipTo", item.transformEquipTo, Number.NaN);
  if (item.transformDeEquipTo != null)
    pushNum(attrs, "transformDeEquipTo", item.transformDeEquipTo, Number.NaN);
  if (item.transformTo != null) pushNum(attrs, "transformTo", item.transformTo, Number.NaN);
  if (item.maleTransformTo != null) pushNum(attrs, "maleTransformTo", item.maleTransformTo, Number.NaN);
  if (item.femaleTransformTo != null)
    pushNum(attrs, "femaleTransformTo", item.femaleTransformTo, Number.NaN);
  pushNum(attrs, "charges", item.charges);
  pushBool(attrs, "showCharges", item.showCharges);
  pushBool(attrs, "showAttributes", item.showAttributes);

  pushNum(attrs, "lightLevel", item.lightLevel);
  pushNum(attrs, "lightColor", item.lightColor);

  pushNum(attrs, "speed", item.speed);
  pushNum(attrs, "healthGain", item.healthGain);
  pushNum(attrs, "healthTicks", item.healthTicks);
  pushNum(attrs, "manaGain", item.manaGain);
  pushNum(attrs, "manaTicks", item.manaTicks);
  pushBool(attrs, "manaShield", item.manaShield);
  pushNum(attrs, "soulPoints", item.soulPoints);
  pushNum(attrs, "soulPointsPercent", item.soulPointsPercent);
  pushNum(attrs, "maxHitPoints", item.maxHitPoints);
  pushNum(attrs, "maxHitPointsPercent", item.maxHitPointsPercent);
  pushNum(attrs, "maxManaPoints", item.maxManaPoints);
  pushNum(attrs, "maxManaPointsPercent", item.maxManaPointsPercent);
  pushNum(attrs, "magicLevelPoints", item.magicLevelPoints);
  pushNum(attrs, "magicLevelPointsPercent", item.magicLevelPointsPercent);
  pushNum(attrs, "increaseMagicValue", item.increaseMagicValue);
  pushNum(attrs, "increaseMagicPercent", item.increaseMagicPercent);
  pushNum(attrs, "increaseHealingValue", item.increaseHealingValue);
  pushNum(attrs, "increaseHealingPercent", item.increaseHealingPercent);

  pushStr(attrs, "runeSpellName", item.runeSpellName);

  const f = item.flags;
  pushBool(attrs, "blocking", f.blocking);
  pushBool(attrs, "blockProjectile", f.blockProjectile);
  pushBool(attrs, "blockPathfind", f.blockPathfind);
  pushBool(attrs, "movable", f.movable, true);
  pushBool(attrs, "pickupable", f.pickupable, true);
  pushBool(attrs, "allowPickupable", f.allowPickupable);
  pushBool(attrs, "showCount", f.showCount, true);
  pushBool(attrs, "dualWield", f.dualWield);
  pushBool(attrs, "preventLoss", f.preventLoss);
  pushBool(attrs, "preventDrop", f.preventDrop);
  pushBool(attrs, "invisible", f.invisible);
  pushBool(attrs, "forceSerialize", f.forceSerialize);
  pushBool(attrs, "replacable", f.replacable, true);
  pushBool(attrs, "walkStack", f.walkStack, true);
  pushBool(attrs, "rotable", f.rotable);
  pushBool(attrs, "canReadText", f.canReadText);
  pushBool(attrs, "allowDistRead", f.allowDistRead);

  for (const key of ITEM_SKILL_KEYS) {
    pushNum(attrs, `skill${SKILL_SUFFIX[key]}`, item.skills[key]);
  }
  for (const key of ITEM_ELEMENT_KEYS) {
    pushNum(attrs, `element${ELEMENT_SUFFIX[key]}`, item.elements[key]);
  }
  for (const key of ITEM_ABSORB_KEYS) {
    pushNum(attrs, `absorbPercent${ABSORB_SUFFIX[key]}`, item.absorbPercent[key]);
  }
  for (const key of ITEM_FIELD_ABSORB_KEYS) {
    pushNum(attrs, `fieldAbsorbPercent${ELEMENT_SUFFIX[key as ItemElementKey]}`, item.fieldAbsorbPercent[key]);
  }
  for (const key of ITEM_ABSORB_KEYS) {
    pushNum(attrs, `reflectPercent${ABSORB_SUFFIX[key]}`, item.reflectPercent[key]);
  }
  for (const key of ITEM_ABSORB_KEYS) {
    pushNum(attrs, `reflectChance${ABSORB_SUFFIX[key]}`, item.reflectChance[key]);
  }
  for (const key of ITEM_SUPPRESS_KEYS) {
    pushBool(attrs, `suppress${SUPPRESS_SUFFIX[key]}`, item.suppress[key]);
  }

  const bodyLines: string[] = attrs.map((attr) => attr);

  if (item.field.enabled) {
    const fieldChildren: string[] = [];
    pushNum(fieldChildren, "ticks", item.field.ticks);
    pushNum(fieldChildren, "count", item.field.count);
    pushNum(fieldChildren, "start", item.field.start);
    for (const damage of item.field.damages) {
      fieldChildren.push(`<attribute key="damage" value="${damage.damage}" />`);
    }

    if (fieldChildren.length === 0) {
      bodyLines.push(`<attribute key="field" value="${item.field.value}" />`);
    } else {
      bodyLines.push(`<attribute key="field" value="${item.field.value}">`);
      bodyLines.push(...indent(fieldChildren, 1));
      bodyLines.push(`</attribute>`);
    }
  }

  for (const entry of item.extraAttributes) {
    bodyLines.push(`<attribute key="${escapeXml(entry.key)}" value="${escapeXml(entry.value)}" />`);
  }

  if (bodyLines.length === 0) {
    return `<item ${rootAttrs.join(" ")} />`;
  }

  const lines = [`<item ${rootAttrs.join(" ")}>`, ...indent(bodyLines, 1), `</item>`];
  return lines.join("\n");
}

export function itemsToXmlDocument(items: ItemInput[]): string {
  const lines = [`<?xml version="1.0" encoding="ISO-8859-1"?>`, `<items>`];
  for (const item of items.slice().sort((a, b) => a.id - b.id)) {
    lines.push(...indent(itemToXml(item).split("\n"), 1));
  }
  lines.push(`</items>`);
  return lines.join("\n") + "\n";
}
