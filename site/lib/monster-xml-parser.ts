import { XMLParser } from "fast-xml-parser";

import { asArray, bool, num, str, type XmlNode } from "@/lib/xml-parse-utils";
import {
  ELEMENT_KEYS,
  IMMUNITY_KEYS,
  defaultMonsterValues,
  lootChanceToPercent,
  monsterFormSchema,
  normalizeSkullValue,
  type AttributeEntryInput,
  type ElementKey,
  type ImmunityKey,
  type MonsterFormInput,
  type MonsterLootItemInput,
  type MonsterSpellInput,
} from "@/lib/validations/admin/monster";

/**
 * Parser dedicado (prefixo de atributo `@_`) em vez do `createXmlParser` compartilhado:
 * `<defenses armor= defense=>` tem um atributo chamado `defense` que colide com o
 * elemento filho `<defense>` quando atributos e filhos usam o mesmo namespace de chave.
 */
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: false,
  trimValues: true,
  isArray: (name) =>
    ["flag", "attack", "defense", "immunity", "element", "voice", "summon", "event", "attribute", "item"].includes(
      name
    ),
});

/** Lê um atributo (`@_key`) do nó já parseado com `attributeNamePrefix: "@_"`. */
function a(node: XmlNode | undefined, key: string): unknown {
  return node?.[`@_${key}`];
}

function parseAttributes(raw: unknown): AttributeEntryInput[] {
  return asArray(raw).map((attribute) => ({
    key: str(a(attribute, "key")),
    value: str(a(attribute, "value")),
  }));
}

function parseSpell(raw: XmlNode): MonsterSpellInput {
  const target = a(raw, "target");
  return {
    spellId: null,
    name: str(a(raw, "name")),
    script: str(a(raw, "script")),
    interval: num(a(raw, "interval") ?? a(raw, "speed")),
    chance: a(raw, "chance") != null ? num(a(raw, "chance")) : 100,
    range: num(a(raw, "range")),
    min: num(a(raw, "min")),
    max: num(a(raw, "max")),
    length: num(a(raw, "length")),
    spread: num(a(raw, "spread")),
    radius: num(a(raw, "radius")),
    target: bool(target) || target === "1",
    speedchange: num(a(raw, "speedchange")),
    duration: num(a(raw, "duration")),
    attributes: parseAttributes(raw.attribute),
  };
}

function parseLootItem(raw: XmlNode): MonsterLootItemInput {
  const childrenRaw = raw.inside ? asArray((raw.inside as XmlNode).item) : asArray(raw.item);
  const subtype = a(raw, "subtype") ?? a(raw, "subType");
  const actionId = a(raw, "actionId") ?? a(raw, "actionid");
  const uniqueId = a(raw, "uniqueId") ?? a(raw, "uniqueid");
  const chance = a(raw, "chance") ?? a(raw, "chance1");

  return {
    id: num(a(raw, "id") ?? a(raw, "ids")),
    count: num(a(raw, "countmax") ?? a(raw, "count")) || 1,
    chance: chance != null ? lootChanceToPercent(num(chance)) : 100,
    subtype: subtype != null ? num(subtype) : null,
    actionId: actionId != null ? num(actionId) : null,
    uniqueId: uniqueId != null ? num(uniqueId) : null,
    text: str(a(raw, "text")),
    comment: "",
    addToAutoloot: false,
    children: childrenRaw.map((child) => parseLootItem(child)),
  };
}

export type ParseMonsterXmlResult = {
  monster: MonsterFormInput | null;
  /** `type=` cru do `<look>` do XML importado (`look type="xx"`), usado para auto-vincular a
   * looktype de outfit cadastrada (`Looktype.looktypeNumber`) na importação sem intervenção manual. */
  lookTypeNumber: number | null;
  error: string | null;
};

/**
 * Faz o parse de um XML `<monster>` isolado (formato `data/monster/.../*.xml`) para o
 * formato do formulário/persistência. `category`/`subcategory` vêm de fora (pasta de
 * origem no import em lote) já que não existem no XML em si.
 */
export function parseMonsterXml(
  xml: string,
  extra: { category?: string; subcategory?: string; universeId?: number | null } = {}
): ParseMonsterXmlResult {
  let parsed: XmlNode;

  try {
    parsed = parser.parse(xml) as XmlNode;
  } catch (error) {
    return {
      monster: null,
      lookTypeNumber: null,
      error: `XML inválido: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const raw = parsed.monster as XmlNode | undefined;
  if (!raw) {
    return { monster: null, lookTypeNumber: null, error: "Nenhum elemento <monster> encontrado no arquivo." };
  }

  const name = str(a(raw, "name"));
  if (!name) {
    return { monster: null, lookTypeNumber: null, error: "<monster> sem atributo name." };
  }

  const look = raw.look as XmlNode | undefined;
  const health = raw.health as XmlNode | undefined;
  const targetchange = raw.targetchange as XmlNode | undefined;
  const strategy = raw.strategy as XmlNode | undefined;

  const flagsRaw = asArray((raw.flags as XmlNode | undefined)?.flag).reduce<Record<string, unknown>>(
    (acc, flag) => Object.assign(acc, flag),
    {}
  );
  const flag = (key: string) => flagsRaw[`@_${key}`];

  const attacksRaw = asArray((raw.attacks as XmlNode | undefined)?.attack);
  const defensesNode = raw.defenses as XmlNode | undefined;
  const defensesRaw = asArray(defensesNode?.defense);

  const immunitiesRaw = asArray((raw.immunities as XmlNode | undefined)?.immunity).reduce<
    Record<string, unknown>
  >((acc, immunity) => Object.assign(acc, immunity), {});
  const elementsRaw = asArray((raw.elements as XmlNode | undefined)?.element).reduce<
    Record<string, unknown>
  >((acc, element) => Object.assign(acc, element), {});

  const immunities = Object.fromEntries(
    IMMUNITY_KEYS.map((key: ImmunityKey) => [key, num(immunitiesRaw[`@_${key}`])])
  ) as Record<ImmunityKey, number>;
  const elements = Object.fromEntries(
    ELEMENT_KEYS.map((key: ElementKey) => [key, num(elementsRaw[`@_${key}`])])
  ) as Record<ElementKey, number>;

  const voicesNode = raw.voices as XmlNode | undefined;
  const voices = asArray(voicesNode?.voice).map((voice) => {
    const yell = a(voice, "yell");
    return {
      sentence: str(a(voice, "sentence") ?? a(voice, "text")),
      yell: bool(yell) || yell === "1",
    };
  });

  const lootNode = raw.loot as XmlNode | undefined;
  const loot = asArray(lootNode?.item).map((item) => parseLootItem(item));

  const summonsNode = raw.summons as XmlNode | undefined;
  const summons = asArray(summonsNode?.summon).map((summon) => ({
    name: str(a(summon, "name")),
    interval: num(a(summon, "interval") ?? a(summon, "speed")) || 2000,
    chance: a(summon, "chance") != null ? num(a(summon, "chance")) : 100,
    amount: num(a(summon, "amount") ?? a(summon, "max")) || 1,
  }));

  const scriptNode = raw.script as XmlNode | undefined;
  const script = asArray(scriptNode?.event)
    .map((event) => str(a(event, "name")))
    .filter(Boolean);

  const candidate: MonsterFormInput = {
    ...defaultMonsterValues,
    name,
    nameDescription: str(a(raw, "nameDescription") ?? a(raw, "description")),
    bestiary: str(a(raw, "bestiary")) || "monster",
    category: extra.category ?? "",
    subcategory: extra.subcategory ?? "",
    universeId: extra.universeId ?? null,
    race: str(a(raw, "race")) || "blood",
    experience: num(a(raw, "experience")),
    speed: num(a(raw, "speed")) || 200,
    manacost: num(a(raw, "manacost")),

    healthNow: num(a(health, "now")) || 1,
    healthMax: num(a(health, "max")) || 1,

    // `type=` do XML importado não é usado diretamente no round-trip — o cadastro da looktype
    // (`lookTypeId`) é quem define `type=` na exportação. Contudo `lookTypeNumber` (o `type=`
    // cru) é retornado no resultado do parse para auto-vincular a looktype de outfit cadastrada
    // (`Looktype.looktypeNumber`) na importação, sem o admin precisar vincular manualmente.
    lookTypeEx: a(look, "typeex") != null ? num(a(look, "typeex")) : null,
    lookHead: num(a(look, "head")),
    lookBody: num(a(look, "body")),
    lookLegs: num(a(look, "legs")),
    lookFeet: num(a(look, "feet")),
    lookAddons: num(a(look, "addons")),
    corpse: num(a(look, "corpse")),

    targetChangeInterval: num(a(targetchange, "interval") ?? a(targetchange, "speed")) || 4000,
    targetChangeChance: num(a(targetchange, "chance")),

    strategyAttack: a(strategy, "attack") != null ? num(a(strategy, "attack")) : null,
    strategyDefense: a(strategy, "defense") != null ? num(a(strategy, "defense")) : null,

    flags: {
      summonable: bool(flag("summonable")) || flag("summonable") === "1",
      attackable: flag("attackable") === undefined ? true : bool(flag("attackable")) || flag("attackable") === "1",
      hostile: flag("hostile") === undefined ? true : bool(flag("hostile")) || flag("hostile") === "1",
      illusionable: bool(flag("illusionable")) || flag("illusionable") === "1",
      convinceable: bool(flag("convinceable")) || flag("convinceable") === "1",
      pushable: flag("pushable") === undefined ? true : bool(flag("pushable")) || flag("pushable") === "1",
      canpushitems: bool(flag("canpushitems")) || flag("canpushitems") === "1",
      canpushcreatures: bool(flag("canpushcreatures")) || flag("canpushcreatures") === "1",
      hidename: bool(flag("hidename")) || flag("hidename") === "1",
      hidehealth: bool(flag("hidehealth")) || flag("hidehealth") === "1",
      lootmessage: num(flag("lootmessage")),
      targetdistance: num(flag("targetdistance")) || 1,
      staticattack: flag("staticattack") != null ? num(flag("staticattack")) : 95,
      lightlevel: num(flag("lightlevel")),
      lightcolor: num(flag("lightcolor")),
      runonhealth: num(flag("runonhealth")),
      lureable: bool(flag("lureable")) || flag("lureable") === "1",
      walkable: bool(flag("walkable")) || flag("walkable") === "1",
      skull: normalizeSkullValue(str(flag("skull")) || "0"),
      shield: str(flag("shield")) || "none",
      emblem: str(flag("emblem")) || "none",
      canwalkonenergy: bool(flag("canwalkonenergy")) || flag("canwalkonenergy") === "1",
      canwalkonfire: bool(flag("canwalkonfire")) || flag("canwalkonfire") === "1",
      canwalkonpoison: bool(flag("canwalkonpoison")) || flag("canwalkonpoison") === "1",
    },
    attacks: attacksRaw.map(parseSpell),
    defenseArmor: num(a(defensesNode, "armor")),
    defenseValue: num(a(defensesNode, "defense")),
    defenses: defensesRaw.map(parseSpell),
    immunities,
    elements,
    voiceInterval: num(a(voicesNode, "interval") ?? a(voicesNode, "speed")) || 5000,
    voiceChance: num(a(voicesNode, "chance")),
    voices,
    loot,
    maxSummons: num(a(summonsNode, "maxSummons") ?? a(summonsNode, "max")),
    summons,
    script,
  };

  const result = monsterFormSchema.safeParse(candidate);
  if (!result.success) {
    return {
      monster: null,
      lookTypeNumber: null,
      error: `"${name}": ${result.error.issues[0]?.message ?? "dados inválidos"}.`,
    };
  }

  return {
    monster: result.data,
    lookTypeNumber: a(look, "type") != null ? num(a(look, "type")) : null,
    error: null,
  };
}
