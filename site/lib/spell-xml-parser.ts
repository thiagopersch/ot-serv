import {
  asArray,
  createSpellXmlParser,
  nullableNum,
  num,
  parseVocationRefs,
  str,
  xmlBool,
  type XmlNode,
} from "@/lib/spell-xml-parse-utils";
import {
  BLOCK_TYPES,
  defaultSpellValues,
  spellFormSchema,
  type BlockType,
  type SpellFormInput,
  type SpellKind,
} from "@/lib/validations/admin/spell";

const parser = createSpellXmlParser();

function parseBlockType(raw: XmlNode): BlockType {
  if (raw.blocktype != null) {
    const value = str(raw.blocktype);
    if ((BLOCK_TYPES as readonly string[]).includes(value)) return value as BlockType;
    return "";
  }
  if (raw.blocking != null && xmlBool(raw.blocking)) return "all";
  return "";
}

function parseSpellNode(
  raw: XmlNode,
  kind: SpellKind,
  vocationNameToId: Map<string, number>,
  validVocationIds: Set<number>
): { spell: SpellFormInput | null; errors: string[] } {
  const errors: string[] = [];
  const name = str(raw.name);

  const { vocations, errors: vocationErrors } = parseVocationRefs(
    raw.vocation,
    vocationNameToId,
    validVocationIds
  );
  for (const error of vocationErrors) errors.push(`"${name || "(sem nome)"}": ${error}`);

  const candidate: SpellFormInput = {
    ...defaultSpellValues,
    kind,
    name,
    words: str(raw.words),
    runeItemId: kind === "rune" ? nullableNum(raw.id) : null,
    level: num(raw.lvl ?? raw.level),
    magicLevel: num(raw.maglv ?? raw.magiclevel),
    mana: num(raw.mana),
    manaPercent: num(raw.manapercent),
    soul: num(raw.soul),
    exhaustion: num(raw.exhaustion),
    enabled: raw.enabled != null ? xmlBool(raw.enabled) : true,
    premium: xmlBool(raw.prem ?? raw.premium),
    needTarget: xmlBool(raw.needtarget),
    needWeapon: xmlBool(raw.needweapon),
    selfTarget: xmlBool(raw.selftarget),
    needLearn: xmlBool(raw.needlearn),
    range: num(raw.range),
    blockType: parseBlockType(raw),
    aggressive: xmlBool(raw.aggressive),
    blockWalls: xmlBool(raw.blockwalls),
    allowFarUse: xmlBool(raw.allowfaruse),
    hasParam: xmlBool(raw.param ?? raw.params),
    needDirection: xmlBool(raw.direction),
    casterTargetOrDirection: xmlBool(raw.casterTargetOrDirection),
    limitRange: num(raw.limitRange),
    hasCharges: xmlBool(raw.charges),
    conjureId: nullableNum(raw.conjureId),
    conjureCount: nullableNum(raw.conjureCount),
    conjureReagentId: nullableNum(raw.reagentId),
    event: str(raw.event),
    scriptValue: str(raw.value) || str(raw.script),
    functionName: str(raw.function),
    description: str(raw.description),
    group: str(raw.group),
    vocations,
  };

  const result = spellFormSchema.safeParse(candidate);

  if (!result.success) {
    errors.push(`"${name || "(sem nome)"}": ${result.error.issues[0]?.message ?? "dados inválidos"}.`);
    return { spell: null, errors };
  }

  return { spell: result.data, errors };
}

export type ParseSpellsXmlResult = {
  spells: SpellFormInput[];
  errors: string[];
};

/**
 * Faz o parse de um `spells.xml` (`<spells><instant/><rune/><conjure/></spells>`) para o
 * formato usado pelo formulário/persistência. Precisa de `vocationNameToId` para resolver
 * `<vocation name="X" />` (a maioria dos dados usa `id=`, mas a engine aceita ambos).
 * Spells com dados inválidos são pulados e reportados em `errors`, sem interromper o parse.
 */
export function parseSpellsXml(xml: string, vocationNameToId: Map<string, number>): ParseSpellsXmlResult {
  const errors: string[] = [];
  const validVocationIds = new Set(vocationNameToId.values());
  let parsed: XmlNode;

  try {
    parsed = parser.parse(xml) as XmlNode;
  } catch (error) {
    return {
      spells: [],
      errors: [`XML inválido: ${error instanceof Error ? error.message : String(error)}`],
    };
  }

  const root = parsed.spells as XmlNode | undefined;

  if (!root) {
    return { spells: [], errors: ["Nenhum elemento <spells> encontrado no arquivo."] };
  }

  const spells: SpellFormInput[] = [];

  const kinds: SpellKind[] = ["instant", "rune", "conjure"];
  for (const kind of kinds) {
    for (const raw of asArray(root[kind])) {
      const { spell, errors: nodeErrors } = parseSpellNode(raw, kind, vocationNameToId, validVocationIds);
      errors.push(...nodeErrors);
      if (spell) spells.push(spell);
    }
  }

  if (spells.length === 0 && errors.length === 0) {
    errors.push("Nenhum <instant>/<rune>/<conjure> encontrado dentro de <spells>.");
  }

  return { spells, errors };
}
