import { asArray, bool, createXmlParser, num, str, type XmlNode } from "@/lib/xml-parse-utils";
import {
  FIELD_TYPES,
  ITEM_ABSORB_KEYS,
  defaultItemValues,
  itemSchema,
  type FieldType,
  type ItemInput,
} from "@/lib/validations/admin/item";

const parser = createXmlParser(["item", "attribute"]);

/** Estado mutável usado enquanto processamos a lista (plana) de `<attribute>` de um item —
 * espelha `ItemInput` mas com os grupos JSON como objetos parciais preenchidos incrementalmente. */
type MutableItem = ItemInput & { extraAttributes: ItemInput["extraAttributes"] };

function newMutableItem(
  id: number,
  name: string,
  article: string,
  plural: string,
  editorSuffix: string,
  clientId: number | null
): MutableItem {
  return {
    ...defaultItemValues,
    id,
    name,
    article,
    plural,
    editorSuffix,
    clientId,
    flags: { ...defaultItemValues.flags },
    skills: { ...defaultItemValues.skills },
    elements: { ...defaultItemValues.elements },
    absorbPercent: { ...defaultItemValues.absorbPercent },
    fieldAbsorbPercent: { ...defaultItemValues.fieldAbsorbPercent },
    reflectPercent: { ...defaultItemValues.reflectPercent },
    reflectChance: { ...defaultItemValues.reflectChance },
    suppress: { ...defaultItemValues.suppress },
    field: { ...defaultItemValues.field },
    extraAttributes: [],
  };
}

const SKILL_ALIASES: Record<string, keyof MutableItem["skills"]> = {
  skillsword: "sword",
  skillaxe: "axe",
  skillclub: "club",
  skilldist: "distance",
  skilldistance: "distance",
  skillshield: "shielding",
  skillshielding: "shielding",
  skillfish: "fishing",
  skillfishing: "fishing",
  skillfist: "fist",
};

const ELEMENT_ALIASES: Record<string, keyof MutableItem["elements"]> = {
  elementphysical: "physical",
  elementfire: "fire",
  elementenergy: "energy",
  elementearth: "earth",
  elementpoison: "earth",
  elementice: "ice",
  elementholy: "holy",
  elementdeath: "death",
  elementlifedrain: "lifeDrain",
  elementmanadrain: "manaDrain",
  elementhealing: "healing",
  elementundefined: "undefined",
};

function withPrefix(prefix: string): Record<string, keyof MutableItem["absorbPercent"]> {
  const map: Record<string, keyof MutableItem["absorbPercent"]> = {};
  for (const key of ITEM_ABSORB_KEYS) map[`${prefix}${key}`] = key;
  map[`${prefix}poison`] = "earth";
  map[`${prefix}drown`] = "drown";
  map[`${prefix}healing`] = "healing";
  return map;
}

const ABSORB_ALIASES = withPrefix("absorbpercent");
const REFLECT_PERCENT_ALIASES = withPrefix("reflectpercent");
const REFLECT_CHANCE_ALIASES = withPrefix("reflectchance");

const FIELD_ABSORB_ALIASES: Record<string, keyof MutableItem["fieldAbsorbPercent"]> = {
  fieldabsorbpercentfire: "fire",
  fieldabsorbpercentenergy: "energy",
  fieldabsorbpercentearth: "earth",
  fieldabsorbpercentpoison: "earth",
};

const SUPPRESS_ALIASES: Record<string, keyof MutableItem["suppress"]> = {
  suppressshock: "energy",
  suppressenergy: "energy",
  suppressburn: "fire",
  suppressfire: "fire",
  suppresspoison: "earth",
  suppressearth: "earth",
  suppressfreeze: "ice",
  suppressice: "ice",
  suppressdazzle: "holy",
  suppressholy: "holy",
  suppresscurse: "death",
  suppressdeath: "death",
  suppressdrown: "drown",
  suppressphysical: "physical",
  suppresshaste: "haste",
  suppressparalyze: "paralyze",
  suppressdrunk: "drunk",
  suppressregeneration: "regeneration",
  suppresssoul: "soul",
  suppressoutfit: "outfit",
  suppressinvisible: "invisible",
  suppressinfight: "inFight",
  suppressexhaust: "exhaustion",
  suppressexhaustion: "exhaustion",
  suppressmuted: "muted",
  suppresspacified: "pacified",
  suppresslight: "light",
  suppressattributes: "attributes",
  suppressmanashield: "manaShield",
  suppresslifedrain: "lifeDrain",
};

function setNum(item: MutableItem, key: string, value: number) {
  (item as unknown as Record<string, number>)[key] = value;
}
function setBool(item: MutableItem, key: string, value: boolean) {
  (item as unknown as Record<string, boolean>)[key] = value;
}
function setStrField(item: MutableItem, key: string, value: string) {
  (item as unknown as Record<string, string>)[key] = value;
}
function setNullableNum(item: MutableItem, key: string, value: number) {
  (item as unknown as Record<string, number | null>)[key] = value;
}

const NUMBER_FIELDS: Record<string, string> = {
  weight: "weight",
  armor: "armor",
  defense: "defense",
  extradefense: "extraDefense",
  extradef: "extraDefense",
  attack: "attack",
  extraattack: "extraAttack",
  extraatk: "extraAttack",
  attackspeed: "attackSpeed",
  range: "range",
  hitchance: "hitChance",
  maxhitchance: "maxHitChance",
  breakchance: "breakChance",
  worth: "worth",
  containersize: "containerSize",
  maxtextlen: "maxTextLen",
  maxtextlength: "maxTextLen",
  duration: "duration",
  charges: "charges",
  lightlevel: "lightLevel",
  lightcolor: "lightColor",
  speed: "speed",
  healthgain: "healthGain",
  healthticks: "healthTicks",
  managain: "manaGain",
  manaticks: "manaTicks",
  soulpoints: "soulPoints",
  soulpointspercent: "soulPointsPercent",
  maxhitpoints: "maxHitPoints",
  maxhitpointspercent: "maxHitPointsPercent",
  maxmanapoints: "maxManaPoints",
  maxmanapointspercent: "maxManaPointsPercent",
  magiclevelpoints: "magicLevelPoints",
  magicpoints: "magicLevelPoints",
  magiclevelpointspercent: "magicLevelPointsPercent",
  magicpointspercent: "magicLevelPointsPercent",
  increasemagicvalue: "increaseMagicValue",
  increasemagicpercent: "increaseMagicPercent",
  increasehealingvalue: "increaseHealingValue",
  increasehealingpercent: "increaseHealingPercent",
};

const NULLABLE_NUMBER_FIELDS: Record<string, string> = {
  rotateto: "rotateTo",
  writeonceitemid: "writeOnceItemId",
  decayto: "decayTo",
  transformequipto: "transformEquipTo",
  onequipto: "transformEquipTo",
  transformdeequipto: "transformDeEquipTo",
  ondeequipto: "transformDeEquipTo",
  transformto: "transformTo",
  maletransformto: "maleTransformTo",
  femaletransformto: "femaleTransformTo",
};

const BOOL_FIELDS: Record<string, string> = {
  readable: "readable",
  writeable: "writeable",
  writable: "writeable",
  stopduration: "stopDuration",
  showduration: "showDuration",
  showcharges: "showCharges",
  showattributes: "showAttributes",
  manashield: "manaShield",
};

const FLAG_BOOL_FIELDS: Record<string, string> = {
  blocking: "blocking",
  blocksolid: "blocking",
  blockprojectile: "blockProjectile",
  blockpathfind: "blockPathfind",
  blockpathing: "blockPathfind",
  blockpath: "blockPathfind",
  movable: "movable",
  moveable: "movable",
  pickupable: "pickupable",
  allowpickupable: "allowPickupable",
  showcount: "showCount",
  dualwield: "dualWield",
  preventloss: "preventLoss",
  preventdrop: "preventDrop",
  invisible: "invisible",
  forceserialize: "forceSerialize",
  forceserialization: "forceSerialize",
  forcesave: "forceSerialize",
  replacable: "replacable",
  replaceable: "replacable",
  walkstack: "walkStack",
  rotable: "rotable",
  rotatable: "rotable",
  canreadtext: "canReadText",
  allowdistread: "allowDistRead",
};

const STRING_FIELDS: Record<string, string> = {
  type: "type",
  weapontype: "weaponType",
  slottype: "slotType",
  ammotype: "ammoType",
  ammoaction: "ammoAction",
  corpsetype: "corpseType",
  shoottype: "shootType",
  effect: "effect",
  fluidsource: "fluidSource",
  floorchange: "floorChange",
  description: "description",
  runespellname: "runeSpellName",
};

function parseAttribute(item: MutableItem, key: string, rawValue: unknown) {
  const lower = key.toLowerCase();

  if (lower in NUMBER_FIELDS) return setNum(item, NUMBER_FIELDS[lower], num(rawValue));
  if (lower in NULLABLE_NUMBER_FIELDS) return setNullableNum(item, NULLABLE_NUMBER_FIELDS[lower], num(rawValue));
  if (lower in BOOL_FIELDS) return setBool(item, BOOL_FIELDS[lower], bool(rawValue) || str(rawValue) === "1");
  if (lower in FLAG_BOOL_FIELDS)
    return setBool(item.flags as unknown as MutableItem, FLAG_BOOL_FIELDS[lower], bool(rawValue) || str(rawValue) === "1");
  if (lower in STRING_FIELDS) return setStrField(item, STRING_FIELDS[lower], str(rawValue));

  if (lower in SKILL_ALIASES) {
    item.skills[SKILL_ALIASES[lower]] = num(rawValue);
    return;
  }
  if (lower in ELEMENT_ALIASES) {
    item.elements[ELEMENT_ALIASES[lower]] = num(rawValue);
    return;
  }
  if (lower in ABSORB_ALIASES) {
    item.absorbPercent[ABSORB_ALIASES[lower]] = num(rawValue);
    return;
  }
  if (lower in REFLECT_PERCENT_ALIASES) {
    item.reflectPercent[REFLECT_PERCENT_ALIASES[lower]] = num(rawValue);
    return;
  }
  if (lower in REFLECT_CHANCE_ALIASES) {
    item.reflectChance[REFLECT_CHANCE_ALIASES[lower]] = num(rawValue);
    return;
  }
  if (lower in FIELD_ABSORB_ALIASES) {
    item.fieldAbsorbPercent[FIELD_ABSORB_ALIASES[lower]] = num(rawValue);
    return;
  }
  if (lower in SUPPRESS_ALIASES) {
    item.suppress[SUPPRESS_ALIASES[lower]] = bool(rawValue) || str(rawValue) === "1";
    return;
  }

  // Não reconhecido — preserva no catch-all para round-trip sem perda.
  item.extraAttributes.push({ key, value: str(rawValue) });
}

function parseFieldBlock(item: MutableItem, node: XmlNode) {
  const value = str(node.value) as FieldType;
  item.field = {
    enabled: true,
    value: FIELD_TYPES.includes(value) ? value : "fire",
    ticks: 0,
    count: 0,
    start: 0,
    damages: [],
  };

  for (const child of asArray(node.attribute)) {
    const childKey = str(child.key).toLowerCase();
    if (childKey === "ticks") item.field.ticks = num(child.value);
    else if (childKey === "count") item.field.count = num(child.value);
    else if (childKey === "start") item.field.start = num(child.value);
    else if (childKey === "damage") item.field.damages.push({ start: null, damage: num(child.value) });
  }
}

function applyAttributes(item: MutableItem, rawAttributes: unknown) {
  for (const attribute of asArray(rawAttributes)) {
    const key = str(attribute.key);
    if (!key) continue;

    if (key.toLowerCase() === "field") {
      parseFieldBlock(item, attribute);
      continue;
    }

    parseAttribute(item, key, attribute.value);
  }
}

/** Expande a string `fromid`/`toid` do XML (`"100"`, ou listas paralelas `"100;200"`) numa
 * lista de pares `[from, to]` — mesmo formato usado pelo engine para `<item fromid="..." toid="...">`. */
function expandIdRanges(fromRaw: string, toRaw: string): Array<[number, number]> {
  const fromParts = fromRaw.split(";").map((part) => Number(part.trim()));
  const toParts = toRaw.split(";").map((part) => Number(part.trim()));
  const pairs: Array<[number, number]> = [];

  for (let i = 0; i < Math.max(fromParts.length, toParts.length); i++) {
    const from = fromParts[i] ?? fromParts[0];
    const to = toParts[i] ?? toParts[0];
    if (Number.isFinite(from) && Number.isFinite(to)) pairs.push([from, to]);
  }

  return pairs;
}

export type ParseItemsXmlResult = {
  items: ItemInput[];
  errors: string[];
};

/**
 * Faz o parse de um `items.xml` do OTServer (`<items><item id=.../fromid=.../toid=... /></items>`)
 * para uma lista de `ItemInput` — um objeto por id concreto (ranges `fromid`/`toid` são
 * expandidos, cada id da faixa recebe uma cópia do mesmo conjunto de atributos). Atributos
 * `<attribute key>` não reconhecidos caem em `extraAttributes` (round-trip sem perda).
 */
export function parseItemsXml(xml: string): ParseItemsXmlResult {
  const errors: string[] = [];
  let parsed: XmlNode;

  try {
    parsed = parser.parse(xml) as XmlNode;
  } catch (error) {
    return { items: [], errors: [`XML inválido: ${error instanceof Error ? error.message : String(error)}`] };
  }

  const rawItems = asArray((parsed.items as XmlNode | undefined)?.item);

  if (rawItems.length === 0) {
    return { items: [], errors: ["Nenhum <item> encontrado dentro de <items>."] };
  }

  // Preserva ordem de inserção mas deixa a última ocorrência de cada id vencer — mesmo
  // comportamento do carregador C++ (`Items::loadFromXml`), que reatribui o ItemType a cada
  // `<item>` processado. Um `items.xml` real costuma ter ids repetidos (fromid/toid de uma
  // categoria sobrepondo um `id` avulso definido em outro lugar do arquivo, por exemplo) — sem
  // isso, `createMany` no import quebra com "Unique constraint failed" no id duplicado.
  const itemsById = new Map<number, ItemInput>();

  rawItems.forEach((raw, index) => {
    const name = str(raw.name);
    const article = str(raw.article);
    const plural = str(raw.plural);
    const editorSuffix = str(raw.editorsuffix);
    const clientId = raw.client_id != null ? num(raw.client_id) : null;

    const singleId = raw.id != null ? num(raw.id) : null;
    const fromId = raw.fromid != null ? str(raw.fromid) : null;
    const toId = raw.toid != null ? str(raw.toid) : null;

    const idRanges: Array<[number, number]> =
      fromId != null && toId != null ? expandIdRanges(fromId, toId) : singleId != null ? [[singleId, singleId]] : [];

    if (idRanges.length === 0) {
      errors.push(`<item> #${index + 1} (${name || "sem nome"}) sem id/fromid+toid válido.`);
      return;
    }

    for (const [from, to] of idRanges) {
      for (let id = from; id <= to; id++) {
        const item = newMutableItem(id, name, article, plural, editorSuffix, clientId);
        applyAttributes(item, raw.attribute);

        const result = itemSchema.safeParse(item);
        if (!result.success) {
          errors.push(`item #${id}: ${result.error.issues[0]?.message ?? "dados inválidos"}.`);
          continue;
        }

        itemsById.set(id, result.data);
      }
    }
  });

  return { items: [...itemsById.values()], errors };
}
