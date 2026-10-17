import { asArray, createXmlParser, num, str } from "@/lib/xml-parse-utils";
import {
  EXTOUTFIT_KINDS,
  extOutfitValueField,
  type ExtOutfitKind,
} from "@/lib/validations/admin/extoutfit";

export type ParsedExtOutfit = {
  kind: ExtOutfitKind;
  xmlId: number;
  name: string;
  looktypeNumber: number | null;
  shaderName: string | null;
  image: string | null;
  posx: number | null;
  posy: number | null;
};

function optionalInt(value: unknown): number | null {
  if (value == null || str(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

/** Lê o `extoutfits.xml` com as mesmas regras do `server/data/lib/extoutfit_parser.lua`: id > 0
 * e único por tag, nome obrigatório, e looktype/shadername/image obrigatório conforme a tag. */
export function parseExtOutfitsXml(xml: string): { entries: ParsedExtOutfit[]; errors: string[] } {
  const errors: string[] = [];
  const entries: ParsedExtOutfit[] = [];

  let doc: Record<string, unknown>;
  try {
    doc = createXmlParser([...EXTOUTFIT_KINDS]).parse(xml) as Record<string, unknown>;
  } catch (error) {
    return { entries, errors: [`XML inválido: ${(error as Error).message}`] };
  }

  const root = (doc.extoutfits ?? {}) as Record<string, unknown>;

  for (const kind of EXTOUTFIT_KINDS) {
    const seenIds = new Set<number>();
    const field = extOutfitValueField(kind);

    for (const node of asArray(root[kind])) {
      const xmlId = num(node.id);
      const name = str(node.name).trim();

      if (!Number.isInteger(xmlId) || xmlId <= 0) {
        errors.push(`<${kind}> "${name}" com id inválido (${str(node.id)}).`);
        continue;
      }
      if (seenIds.has(xmlId)) {
        errors.push(`<${kind}> id ${xmlId} duplicado (ignorado).`);
        continue;
      }
      if (!name) {
        errors.push(`<${kind}> id ${xmlId} sem nome.`);
        continue;
      }

      const entry: ParsedExtOutfit = {
        kind,
        xmlId,
        name: name.slice(0, 100),
        looktypeNumber: null,
        shaderName: null,
        image: null,
        posx: optionalInt(node.posx),
        posy: optionalInt(node.posy),
      };

      if (field === "looktype") {
        const looktype = num(node.looktype ?? node.lookType ?? node.LookType);
        if (looktype <= 0) {
          errors.push(`<${kind}> id ${xmlId} ("${name}") sem looktype.`);
          continue;
        }
        entry.looktypeNumber = looktype;
      } else if (field === "shadername") {
        entry.shaderName = str(node.shadername).trim();
        if (!entry.shaderName) {
          errors.push(`<${kind}> id ${xmlId} ("${name}") sem shadername.`);
          continue;
        }
      } else {
        entry.image = str(node.image).trim();
        if (!entry.image) {
          errors.push(`<${kind}> id ${xmlId} ("${name}") sem image.`);
          continue;
        }
      }

      seenIds.add(xmlId);
      entries.push(entry);
    }
  }

  return { entries, errors };
}
