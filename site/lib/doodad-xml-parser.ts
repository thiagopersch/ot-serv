import { normalizeCarpets } from "@/lib/doodad-mapper";
import {
  asArray,
  bool,
  createXmlParser,
  num,
  parseAlternates,
  parseComposites,
  parseItems,
  str,
  type XmlNode,
} from "@/lib/xml-parse-utils";
import {
  DOODAD_BRUSH_TYPES,
  baseDoodadFormSchema,
  defaultDoodadValues,
  isWallBrushType,
  type CarpetEntryInput,
  type DoodadFormInput,
  type TableSegmentInput,
  type WallSegmentInput,
} from "@/lib/validations/admin/doodad";

const parser = createXmlParser();

function parseCarpets(raw: unknown): CarpetEntryInput[] {
  return asArray(raw).map((carpet) => ({
    align: str(carpet.align) as CarpetEntryInput["align"],
    id: num(carpet.id),
  }));
}

function parseDoors(raw: unknown): WallSegmentInput["doors"] {
  return asArray(raw).map((door) => ({
    id: num(door.id),
    type: str(door.type) as WallSegmentInput["doors"][number]["type"],
    open: bool(door.open),
    hate: bool(door.hate),
  }));
}

function parseWalls(raw: unknown): WallSegmentInput[] {
  return asArray(raw).map((wall) => ({
    type: str(wall.type) as WallSegmentInput["type"],
    items: parseItems(wall.item),
    doors: parseDoors(wall.door),
  }));
}

function parseTables(raw: unknown): TableSegmentInput[] {
  return asArray(raw).map((table) => ({
    align: str(table.align) as TableSegmentInput["align"],
    items: parseItems(table.item),
  }));
}

export type ParseDoodadsXmlResult = {
  brushes: DoodadFormInput[];
  errors: string[];
};

/**
 * Faz o parse de um `doodads.xml` do RME (`<materials><brush>...</brush></materials>`)
 * para o formato usado pelo formulário/persistência. Brushes com `type` desconhecido ou
 * dados que não passam na validação são pulados e reportados em `errors`, sem interromper
 * o parse dos demais.
 */
export function parseDoodadsXml(xml: string): ParseDoodadsXmlResult {
  const errors: string[] = [];
  let parsed: XmlNode;

  try {
    parsed = parser.parse(xml) as XmlNode;
  } catch (error) {
    return {
      brushes: [],
      errors: [`XML inválido: ${error instanceof Error ? error.message : String(error)}`],
    };
  }

  const materials = parsed.materials as XmlNode | undefined;
  const rawBrushes = asArray(materials?.brush);

  if (rawBrushes.length === 0) {
    return { brushes: [], errors: ["Nenhum <brush> encontrado dentro de <materials>."] };
  }

  const brushes: DoodadFormInput[] = [];

  rawBrushes.forEach((raw, index) => {
    const name = str(raw.name) || `brush #${index + 1}`;
    const type = str(raw.type);

    if (!DOODAD_BRUSH_TYPES.includes(type as DoodadFormInput["type"])) {
      errors.push(`"${name}": type desconhecido ("${type}").`);
      return;
    }

    const candidate: DoodadFormInput = {
      ...defaultDoodadValues,
      name,
      type: type as DoodadFormInput["type"],
      serverLookId: num(raw.server_lookid),
      draggable: bool(raw.draggable),
      onBlocking: bool(raw.on_blocking),
      thickness: str(raw.thickness),
      onDuplicate: bool(raw.on_duplicate),
      oneSize: bool(raw.one_size),
      redoBorders: bool(raw.redo_borders),
      reborder: bool(raw.reborder),
    };

    if (type === "doodad") {
      candidate.items = parseItems(raw.item);
      candidate.composites = parseComposites(raw.composite);
      candidate.alternates = parseAlternates(raw.alternate);
    } else if (type === "carpet") {
      candidate.carpets = normalizeCarpets(parseCarpets(raw.carpet));
    } else if (isWallBrushType(type)) {
      candidate.walls = parseWalls(raw.wall);
    } else if (type === "table") {
      candidate.tables = parseTables(raw.table);
    }

    // `tilesetCategoryId` não existe no doodads.xml — é atribuído depois, pelo admin, no CRUD
    // de tilesets (ex.: seção "Sem categoria"). Validar contra o schema completo (que exige
    // categoria) rejeitaria todo brush importado de um arquivo real.
    const result = baseDoodadFormSchema.safeParse(candidate);

    if (!result.success) {
      errors.push(`"${name}": ${result.error.issues[0]?.message ?? "dados inválidos"}.`);
      return;
    }

    brushes.push(result.data);
  });

  return { brushes, errors };
}
