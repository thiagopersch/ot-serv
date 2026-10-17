import { asArray, bool, createXmlParser, num, parseItems, str, type XmlNode } from "@/lib/xml-parse-utils";
import {
  baseGroundFormSchema,
  defaultGroundValues,
  type GroundBorderRefInput,
  type GroundFormInput,
  type GroundFriendInput,
} from "@/lib/validations/admin/ground";

const parser = createXmlParser(["border"]);

function parseBorders(raw: unknown): GroundBorderRefInput[] {
  return asArray(raw).map((border) => ({
    align: str(border.align) as GroundBorderRefInput["align"],
    to: border.to != null ? str(border.to) : null,
    borderId: num(border.id),
  }));
}

function parseFriends(raw: unknown): GroundFriendInput[] {
  return asArray(raw).map((friend) => ({ name: str(friend.name) }));
}

export type ParseGroundsXmlResult = {
  grounds: GroundFormInput[];
  errors: string[];
};

/**
 * Faz o parse de um `grounds.xml` do RME (`<materials><brush type="ground">...</brush></materials>`)
 * para o formato usado pelo formulário/persistência.
 */
export function parseGroundsXml(xml: string): ParseGroundsXmlResult {
  const errors: string[] = [];
  let parsed: XmlNode;

  try {
    parsed = parser.parse(xml) as XmlNode;
  } catch (error) {
    return {
      grounds: [],
      errors: [`XML inválido: ${error instanceof Error ? error.message : String(error)}`],
    };
  }

  const materials = parsed.materials as XmlNode | undefined;
  const rawBrushes = asArray(materials?.brush);

  if (rawBrushes.length === 0) {
    return { grounds: [], errors: ["Nenhum <brush> encontrado dentro de <materials>."] };
  }

  const grounds: GroundFormInput[] = [];

  rawBrushes.forEach((raw, index) => {
    const name = str(raw.name) || `ground #${index + 1}`;
    const type = str(raw.type);

    if (type !== "ground") {
      errors.push(`"${name}": type "${type}" não é "ground", ignorado.`);
      return;
    }

    const candidate: GroundFormInput = {
      ...defaultGroundValues,
      name,
      // Algumas linhas do arquivo real usam `lookid` em vez de `server_lookid` (typo da fonte).
      serverLookId: num(raw.server_lookid ?? raw.lookid),
      zOrder: num(raw["z-order"]),
      soloOptional: bool(raw.solo_optional),
      items: parseItems(raw.item),
      borders: parseBorders(raw.border),
      friends: parseFriends(raw.friend),
    };

    // `tilesetCategoryId` não existe no grounds.xml — é atribuído depois, pelo admin, no CRUD
    // de tilesets. Validar contra o schema completo (que exige categoria) rejeitaria todo
    // brush importado de um arquivo real.
    const result = baseGroundFormSchema.safeParse(candidate);

    if (!result.success) {
      errors.push(`"${name}": ${result.error.issues[0]?.message ?? "dados inválidos"}.`);
      return;
    }

    grounds.push(result.data);
  });

  return { grounds, errors };
}
