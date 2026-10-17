import { asArray, createXmlParser, num, str } from "@/lib/xml-parse-utils";

export type ParsedOutfit = {
  id: number;
  name: string;
  type: number;
  premium: boolean;
  storageId: string | null;
  storageValue: string | null;
  maleLooktypeNumber: number;
  femaleLooktypeNumber: number;
  extraAttributes: Record<string, string> | null;
};

/** Bloco gerado por `/admin/custom-outfits` (`lib/custom-outfit-sync.ts`) — é dono das próprias
 * outfits, então fica fora deste cadastro. */
const CUSTOM_OUTFITS_BLOCK = /<!-- CUSTOM_OUTFITS:BEGIN[\s\S]*?<!-- CUSTOM_OUTFITS:END -->/g;

function stripCustomOutfitsBlock(xml: string): string {
  return xml.replace(CUSTOM_OUTFITS_BLOCK, "");
}

const KNOWN_ATTRIBUTES = new Set(["id", "type", "name", "premium", "storageId", "storageValue"]);

/** Lê o `outfits.xml` do servidor. `<list gender="1">` = masculino, `gender="0"` = feminino;
 * se só um dos dois existir, o mesmo looktype é usado nos dois. */
export function parseOutfitsXml(xml: string): { outfits: ParsedOutfit[]; errors: string[] } {
  const errors: string[] = [];
  const outfits: ParsedOutfit[] = [];
  const seenIds = new Set<number>();

  let doc: Record<string, unknown>;
  try {
    doc = createXmlParser(["outfit", "list"]).parse(stripCustomOutfitsBlock(xml)) as Record<string, unknown>;
  } catch (error) {
    return { outfits, errors: [`XML inválido: ${(error as Error).message}`] };
  }

  const root = (doc.outfits ?? {}) as Record<string, unknown>;

  for (const node of asArray(root.outfit)) {
    const id = num(node.id);
    const name = str(node.name).trim();

    if (!Number.isInteger(id) || id <= 0) {
      errors.push(`Outfit "${name}" com id inválido (${str(node.id)}).`);
      continue;
    }
    if (seenIds.has(id)) {
      errors.push(`Outfit id ${id} duplicada (ignorada).`);
      continue;
    }
    if (!name) {
      errors.push(`Outfit id ${id} sem nome.`);
      continue;
    }

    let male = 0;
    let female = 0;
    for (const list of asArray(node.list)) {
      const looktype = num(list.looktype ?? list.lookType);
      if (str(list.gender) === "1") male = looktype;
      else if (str(list.gender) === "0") female = looktype;
    }
    male ||= female;
    female ||= male;

    if (male <= 0) {
      errors.push(`Outfit id ${id} ("${name}") sem looktype.`);
      continue;
    }

    const extra: Record<string, string> = {};
    for (const [key, value] of Object.entries(node)) {
      if (KNOWN_ATTRIBUTES.has(key) || typeof value === "object") continue;
      extra[key] = str(value);
    }

    seenIds.add(id);
    outfits.push({
      id,
      name: name.slice(0, 100),
      type: num(node.type),
      premium: ["yes", "1", "true"].includes(str(node.premium).toLowerCase()),
      storageId: str(node.storageId).trim() || null,
      storageValue: str(node.storageValue).trim() || null,
      maleLooktypeNumber: male,
      femaleLooktypeNumber: female,
      extraAttributes: Object.keys(extra).length > 0 ? extra : null,
    });
  }

  return { outfits, errors };
}
