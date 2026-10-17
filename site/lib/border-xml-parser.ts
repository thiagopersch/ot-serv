import { asArray, createXmlParser, num, str, type XmlNode } from "@/lib/xml-parse-utils";
import {
  borderFormSchema,
  defaultBorderValues,
  normalizeBorderEdges,
  type BorderEdgeItemInput,
  type BorderFormInput,
} from "@/lib/validations/admin/border";

const parser = createXmlParser(["borderitem"]);

/** O nome do border é escrito como comentário inline `<border id="1"> -- nome --`. */
function parseBorderName(raw: XmlNode, id: number): string {
  const text = str(raw["#text"]).trim();
  const cleaned = text.replace(/^-+\s*/, "").replace(/\s*-+$/, "").trim();
  return cleaned || `border ${id}`;
}

function parseEdges(raw: unknown): BorderEdgeItemInput[] {
  return asArray(raw).map((item) => ({
    edge: str(item.edge) as BorderEdgeItemInput["edge"],
    itemId: num(item.item),
  }));
}

export type ParseBordersXmlResult = {
  borders: BorderFormInput[];
  errors: string[];
};

/**
 * Faz o parse de um `borders.xml` do RME (`<materials><border>...</border></materials>`)
 * para o formato usado pelo formulário/persistência.
 */
export function parseBordersXml(xml: string): ParseBordersXmlResult {
  const errors: string[] = [];
  let parsed: XmlNode;

  try {
    parsed = parser.parse(xml) as XmlNode;
  } catch (error) {
    return {
      borders: [],
      errors: [`XML inválido: ${error instanceof Error ? error.message : String(error)}`],
    };
  }

  const materials = parsed.materials as XmlNode | undefined;
  const rawBorders = asArray(materials?.border);

  if (rawBorders.length === 0) {
    return { borders: [], errors: ["Nenhum <border> encontrado dentro de <materials>."] };
  }

  const borders: BorderFormInput[] = [];

  rawBorders.forEach((raw, index) => {
    const id = num(raw.id);
    const label = `border #${id || index + 1}`;

    const candidate: BorderFormInput = {
      ...defaultBorderValues,
      id,
      name: parseBorderName(raw, id),
      group: raw.group != null ? num(raw.group) : null,
      optional: str(raw.type) === "optional",
      edges: normalizeBorderEdges(parseEdges(raw.borderitem)),
    };

    const result = borderFormSchema.safeParse(candidate);

    if (!result.success) {
      errors.push(`"${label}": ${result.error.issues[0]?.message ?? "dados inválidos"}.`);
      return;
    }

    borders.push(result.data);
  });

  return { borders, errors };
}
