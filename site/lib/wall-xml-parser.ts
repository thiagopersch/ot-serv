import {
  asArray,
  bool,
  createXmlParser,
  nullableBool,
  num,
  parseAlternates,
  parseComposites,
  parseItems,
  str,
  type XmlNode,
} from "@/lib/xml-parse-utils";
import {
  WALL_FILE_BRUSH_TYPES,
  baseWallFormSchema,
  defaultWallValues,
  type FriendInput,
  type WallFormInput,
  type WallSegmentInput,
} from "@/lib/validations/admin/wall";

const parser = createXmlParser();

function parseDoors(raw: unknown): WallSegmentInput["doors"] {
  return asArray(raw).map((door) => ({
    id: num(door.id),
    type: str(door.type),
    open: nullableBool(door.open),
    locked: bool(door.locked),
  }));
}

function parseWalls(raw: unknown): WallSegmentInput[] {
  return asArray(raw).map((wall) => ({
    type: str(wall.type) as WallSegmentInput["type"],
    items: parseItems(wall.item),
    doors: parseDoors(wall.door),
  }));
}

function parseFriends(raw: unknown): FriendInput[] {
  return asArray(raw).map((friend) => ({
    // o arquivo real tem uma ocorrência com `id=` em vez de `name=` (bug da fonte).
    name: str(friend.name ?? friend.id),
    redirect: bool(friend.redirect),
  }));
}

export type ParseWallsXmlResult = {
  brushes: WallFormInput[];
  errors: string[];
};

/**
 * Faz o parse de um `walls.xml` do RME (`<materials><brush>...</brush></materials>`)
 * para o formato usado pelo formulário/persistência. Brushes com `type` desconhecido ou
 * dados que não passam na validação são pulados e reportados em `errors`.
 */
export function parseWallsXml(xml: string): ParseWallsXmlResult {
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

  const brushes: WallFormInput[] = [];

  rawBrushes.forEach((raw, index) => {
    const name = str(raw.name) || `brush #${index + 1}`;
    const type = str(raw.type);

    if (!WALL_FILE_BRUSH_TYPES.includes(type as WallFormInput["type"])) {
      errors.push(`"${name}": type desconhecido ("${type}").`);
      return;
    }

    const candidate: WallFormInput = {
      ...defaultWallValues,
      name,
      type: type as WallFormInput["type"],
      serverLookId: num(raw.server_lookid),
      draggable: bool(raw.draggable),
      onBlocking: bool(raw.on_blocking),
      thickness: str(raw.thickness),
      onDuplicate: bool(raw.on_duplicate),
      oneSize: bool(raw.one_size),
      redoBorders: bool(raw.redo_borders),
      reborder: bool(raw.reborder),
      friends: parseFriends(raw.friend),
    };

    // O conteúdo real do brush (tags <wall> vs <item>/<alternate>/<composite> soltos)
    // nem sempre corresponde ao `type` declarado — ex.: "broken wall" tem type="wall"
    // mas usa <alternate> direto, sem nenhum <wall type="...">. Detecta pelo que
    // realmente existe no XML para não perder conteúdo.
    if (raw.wall != null) {
      candidate.walls = parseWalls(raw.wall);
    } else {
      candidate.items = parseItems(raw.item);
      candidate.composites = parseComposites(raw.composite);
      candidate.alternates = parseAlternates(raw.alternate);
    }

    // `tilesetCategoryId` não existe no walls.xml — é atribuído depois, pelo admin, no CRUD
    // de tilesets. Validar contra o schema completo (que exige categoria) rejeitaria todo
    // brush importado de um arquivo real.
    const result = baseWallFormSchema.safeParse(candidate);

    if (!result.success) {
      errors.push(`"${name}": ${result.error.issues[0]?.message ?? "dados inválidos"}.`);
      return;
    }

    brushes.push(result.data);
  });

  return { brushes, errors };
}
