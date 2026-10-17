import type { VocationInput } from "@/lib/validations/admin/vocation";

function fmtInt(value: number) {
  return String(Math.trunc(value));
}

function fmtFloat(value: number) {
  return Number.isInteger(value) ? value.toFixed(1) : String(value);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type VocationXmlData = VocationInput & {
  archetypeName?: string | null;
  typeUniverseName: string;
  typeUniverseColor?: string | null;
};

export function vocationToXml(vocation: VocationXmlData): string {
  const attrs = [
    `id="${fmtInt(vocation.id)}"`,
    `name="${escapeXml(vocation.name)}"`,
    `description="${escapeXml(vocation.description)}"`,
    `needpremium="${vocation.needpremium ? "1" : "0"}"`,
    `gaincap="${fmtInt(vocation.gaincap)}"`,
    `gainhp="${fmtInt(vocation.gainhp)}"`,
    `gainmana="${fmtInt(vocation.gainmana)}"`,
    `gainhpticks="${fmtInt(vocation.gainhpticks)}"`,
    `gainhpamount="${fmtInt(vocation.gainhpamount)}"`,
    `gainmanaticks="${fmtInt(vocation.gainmanaticks)}"`,
    `gainmanaamount="${fmtInt(vocation.gainmanaamount)}"`,
    `manamultiplier="${fmtFloat(vocation.manamultiplier)}"`,
    `attackspeed="${fmtInt(vocation.attackspeed)}"`,
    `soulmax="${fmtInt(vocation.soulmax)}"`,
    `gainsoulticks="${fmtInt(vocation.gainsoulticks)}"`,
    `fromvoc="${fmtInt(vocation.fromvoc)}"`,
    `type_universe="${escapeXml(vocation.typeUniverseName)}"`,
    `maxrank="${fmtInt(vocation.maxRank)}"`,
  ];

  if (vocation.archetypeName) {
    attrs.push(`archetype="${escapeXml(vocation.archetypeName)}"`);
  }
  if (vocation.specificFragmentItemId) {
    attrs.push(`specificfragmentitemid="${fmtInt(vocation.specificFragmentItemId)}"`);
  }

  const formula = vocation.formula;
  const formulaAttrs = [
    `meleeDamage="${fmtFloat(formula.meleeDamage)}"`,
    `distDamage="${fmtFloat(formula.distDamage)}"`,
    `wandDamage="${fmtFloat(formula.wandDamage)}"`,
    `magDamage="${fmtFloat(formula.magDamage)}"`,
    `magHealingDamage="${fmtFloat(formula.magHealingDamage)}"`,
    `defense="${fmtFloat(formula.defense)}"`,
    `magDefense="${fmtFloat(formula.magDefense)}"`,
    `armor="${fmtFloat(formula.armor)}"`,
  ];

  const skill = vocation.skill;
  const skillAttrs = [
    `fist="${fmtFloat(skill.fist)}"`,
    `club="${fmtFloat(skill.club)}"`,
    `sword="${fmtFloat(skill.sword)}"`,
    `axe="${fmtFloat(skill.axe)}"`,
    `distance="${fmtFloat(skill.distance)}"`,
    `shielding="${fmtFloat(skill.shielding)}"`,
    `fishing="${fmtFloat(skill.fishing)}"`,
    `experience="${fmtFloat(skill.experience)}"`,
  ];

  return [
    `<vocation ${attrs.join(" ")}>`,
    `    <formula ${formulaAttrs.join(" ")} />`,
    `    <skill ${skillAttrs.join(" ")} />`,
    `</vocation>`,
  ].join("\n");
}

export function vocationsToXmlDocument(vocations: VocationXmlData[]): string {
  const body = vocations
    .map((vocation) =>
      vocationToXml(vocation)
        .split("\n")
        .map((line) => `    ${line}`)
        .join("\n")
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<vocations>\n${body}\n</vocations>\n`;
}
