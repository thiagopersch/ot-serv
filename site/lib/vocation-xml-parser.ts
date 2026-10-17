import { asArray, createXmlParser, num, str, type XmlNode } from "@/lib/xml-parse-utils";
import { defaultVocationValues, vocationSchema, type VocationInput } from "@/lib/validations/admin/vocation";

const parser = createXmlParser(["vocation"]);

export type ParsedVocation = VocationInput & { archetypeName: string; typeUniverseName: string };

export type ParseVocationsXmlResult = {
  vocations: ParsedVocation[];
  errors: string[];
};

/**
 * Faz o parse de um `vocations.xml` do OTServer (`<vocations><vocation ...><formula .../>
 * <skill .../></vocation></vocations>`) para o formato usado pelo formulário/persistência.
 * `archetype`/`type_universe` vêm como nome (string) no XML — são resolvidos/criados por
 * nome em `VocationArchetype`/`Universe` na importação, não aqui.
 */
export function parseVocationsXml(xml: string): ParseVocationsXmlResult {
  const errors: string[] = [];
  let parsed: XmlNode;

  try {
    parsed = parser.parse(xml) as XmlNode;
  } catch (error) {
    return {
      vocations: [],
      errors: [`XML inválido: ${error instanceof Error ? error.message : String(error)}`],
    };
  }

  const rawVocations = asArray((parsed.vocations as XmlNode | undefined)?.vocation);

  if (rawVocations.length === 0) {
    return { vocations: [], errors: ["Nenhum <vocation> encontrado dentro de <vocations>."] };
  }

  const vocations: ParsedVocation[] = [];

  rawVocations.forEach((raw, index) => {
    const name = str(raw.name) || `vocação #${index + 1}`;
    const id = raw.id != null ? num(raw.id) : NaN;

    if (!Number.isFinite(id)) {
      errors.push(`"${name}": <vocation> sem atributo id válido.`);
      return;
    }

    const formula = (raw.formula as XmlNode) ?? {};
    const skill = (raw.skill as XmlNode) ?? {};

    const candidate: ParsedVocation = {
      ...defaultVocationValues,
      id,
      name: str(raw.name),
      description: str(raw.description),
      needpremium: str(raw.needpremium) === "1",
      gaincap: num(raw.gaincap),
      gainhp: num(raw.gainhp),
      gainmana: num(raw.gainmana),
      gainhpticks: num(raw.gainhpticks),
      gainhpamount: num(raw.gainhpamount),
      gainmanaticks: num(raw.gainmanaticks),
      gainmanaamount: num(raw.gainmanaamount),
      manamultiplier: num(raw.manamultiplier) || 1,
      attackspeed: num(raw.attackspeed),
      soulmax: num(raw.soulmax),
      gainsoulticks: num(raw.gainsoulticks),
      fromvoc: num(raw.fromvoc),
      typeUniverseId: null,
      maxRank: num(raw.maxrank),
      archetypeId: null,
      specificFragmentItemId: raw.specificfragmentitemid != null ? num(raw.specificfragmentitemid) : null,
      formula: {
        meleeDamage: num(formula.meleeDamage) || 1,
        distDamage: num(formula.distDamage) || 1,
        wandDamage: num(formula.wandDamage) || 1,
        magDamage: num(formula.magDamage) || 1,
        magHealingDamage: num(formula.magHealingDamage) || 1,
        defense: num(formula.defense) || 1,
        magDefense: num(formula.magDefense) || 1,
        armor: num(formula.armor) || 1,
      },
      skill: {
        fist: num(skill.fist) || 1,
        club: num(skill.club) || 1,
        sword: num(skill.sword) || 1,
        axe: num(skill.axe) || 1,
        distance: num(skill.distance) || 1,
        shielding: num(skill.shielding) || 1,
        fishing: num(skill.fishing) || 1,
        experience: num(skill.experience) || 1,
      },
      archetypeName: str(raw.archetype),
      typeUniverseName: str(raw.type_universe),
    };

    const result = vocationSchema.safeParse(candidate);

    if (!result.success) {
      errors.push(`"${name}": ${result.error.issues[0]?.message ?? "dados inválidos"}.`);
      return;
    }

    vocations.push({ ...result.data, archetypeName: candidate.archetypeName, typeUniverseName: candidate.typeUniverseName });
  });

  return { vocations, errors };
}
