import type { SpellFormInput } from "@/lib/validations/admin/spell";
import { escapeXml, indent } from "@/lib/xml-utils";

/**
 * Monta `<instant>/<rune>/<conjure>` a partir do form. Atributos só são emitidos quando
 * diferentes do valor padrão (mesmo critério do `doodadToXml`) — não tenta reproduzir
 * byte-a-byte o `spells.xml` original (que sempre escreve alguns atributos como
 * `needlearn="0"` mesmo no default), só precisa ser um round-trip válido pelo nosso parser.
 */
export function spellToXml(spell: SpellFormInput, vocationNameById?: Map<number, string>): string {
  const tag = spell.kind;
  const attrs: string[] = [`name="${escapeXml(spell.name)}"`];

  if (spell.kind === "rune") {
    if (spell.runeItemId != null) attrs.push(`id="${spell.runeItemId}"`);
  } else {
    if (spell.words) attrs.push(`words="${escapeXml(spell.words)}"`);
  }

  if (spell.level) attrs.push(`lvl="${spell.level}"`);
  if (spell.magicLevel) attrs.push(`maglv="${spell.magicLevel}"`);
  if (spell.mana) attrs.push(`mana="${spell.mana}"`);
  if (spell.manaPercent) attrs.push(`manapercent="${spell.manaPercent}"`);
  if (spell.soul) attrs.push(`soul="${spell.soul}"`);
  if (!spell.enabled) attrs.push(`enabled="0"`);
  if (spell.premium) attrs.push(`prem="1"`);
  if (spell.needTarget) attrs.push(`needtarget="1"`);
  if (spell.needWeapon) attrs.push(`needweapon="1"`);
  if (spell.selfTarget) attrs.push(`selftarget="1"`);
  if (spell.range) attrs.push(`range="${spell.range}"`);
  if (spell.blockType) attrs.push(`blocktype="${spell.blockType}"`);
  if (spell.aggressive) attrs.push(`aggressive="1"`);

  if (spell.kind === "rune") {
    if (spell.allowFarUse) attrs.push(`allowfaruse="1"`);
    if (spell.blockWalls) attrs.push(`blockwalls="1"`);
    if (spell.hasCharges) attrs.push(`charges="1"`);
  } else {
    if (spell.blockWalls) attrs.push(`blockwalls="1"`);
    if (spell.hasParam) attrs.push(`params="1"`);
    if (spell.needDirection) attrs.push(`direction="1"`);
    if (spell.casterTargetOrDirection) attrs.push(`casterTargetOrDirection="1"`);
    if (spell.limitRange) attrs.push(`limitRange="${spell.limitRange}"`);
  }

  if (spell.exhaustion) attrs.push(`exhaustion="${spell.exhaustion}"`);
  if (spell.needLearn) attrs.push(`needlearn="1"`);

  if (spell.kind === "conjure") {
    if (spell.conjureId != null) attrs.push(`conjureId="${spell.conjureId}"`);
    if (spell.conjureCount != null) attrs.push(`conjureCount="${spell.conjureCount}"`);
    if (spell.conjureReagentId != null) attrs.push(`reagentId="${spell.conjureReagentId}"`);
  }

  if (spell.event) attrs.push(`event="${escapeXml(spell.event)}"`);
  if (spell.scriptValue) attrs.push(`value="${escapeXml(spell.scriptValue)}"`);
  if (spell.functionName) attrs.push(`function="${escapeXml(spell.functionName)}"`);
  if (spell.description) attrs.push(`description="${escapeXml(spell.description)}"`);
  if (spell.group) attrs.push(`group="${escapeXml(spell.group)}"`);

  const vocationLines = spell.vocations.map((voc) => {
    const showAttr = voc.showInDescription ? "" : ` showInDescription="0"`;
    const name = vocationNameById?.get(voc.vocationId);
    const comment = name ? ` <!-- ${name.replace(/--/g, "-")} -->` : "";
    return `<vocation id="${voc.vocationId}"${showAttr} />${comment}`;
  });

  if (vocationLines.length === 0) {
    return `<${tag} ${attrs.join(" ")} />`;
  }

  return [`<${tag} ${attrs.join(" ")}>`, ...indent(vocationLines, 1), `</${tag}>`].join("\n");
}

export function spellsToXmlDocument(
  spells: SpellFormInput[],
  vocationNameById?: Map<number, string>
): string {
  const body = spells
    .map((spell) =>
      spellToXml(spell, vocationNameById)
        .split("\n")
        .map((line) => `    ${line}`)
        .join("\n")
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<spells>\n${body}\n</spells>\n`;
}
