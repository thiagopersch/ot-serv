import type { TilesetCategoryKind, TilesetXmlCategory, TilesetXmlDocument, TilesetXmlEntry } from "@/lib/validations/admin/tileset";

/**
 * `tilesets.xml` (RME) é lido com regex, não com `fast-xml-parser`/`createXmlParser`
 * (usado pelos demais `*-xml-parser.ts`). Dois motivos: (1) o nome da categoria é
 * inferido de um comentário `<!-- nome -->` imediatamente antes da tag, e comentários
 * não preservam posição/ordem de forma confiável com o parser DOM-like usado no resto
 * do projeto; (2) uma mesma tileset pode ter mais de uma categoria com a mesma tag
 * (ex.: dois `<items>` na tileset "Tools"), e brush/item ficam livremente
 * interleaved — precisamos da ordem exata de aparição no texto, não de um agrupamento
 * por nome de tag. O formato de `tilesets.xml` é regular o bastante (tags folha só
 * com atributos) para isso ser seguro.
 */

// Do mais específico para o menos específico — evita casar "terrain" antes de "terrain_and_raw".
const CATEGORY_TAG_PATTERN = "terrain_and_raw|doodad_and_raw|items_and_raw|terrain|doodad|raw|items";

const TAG_TO_KIND: Record<string, TilesetCategoryKind> = {
  terrain: "TERRAIN",
  terrain_and_raw: "TERRAIN_AND_RAW",
  doodad: "DOODAD",
  doodad_and_raw: "DOODAD_AND_RAW",
  raw: "RAW",
  items: "ITEMS",
  items_and_raw: "ITEMS_AND_RAW",
};

const TILESET_BLOCK_RE = /<tileset\s+name="([^"]*)"\s*>([\s\S]*?)<\/tileset>/g;

const CATEGORY_BLOCK_RE = new RegExp(
  `(?:<!--\\s*([\\s\\S]*?)\\s*-->\\s*)?<(${CATEGORY_TAG_PATTERN})\\b[^>]*>([\\s\\S]*?)<\\/\\2>`,
  "g"
);

/** Casa `<brush name=".."/>`, `<item id=".."/>`, `<item fromid=".." toid=".."/>` (nessa
 * ordem de aparição no texto) — incluindo variações reais observadas no arquivo:
 * `<item id=".." toid=".."/>` (bug de copiar/colar no lugar de `fromid`) e espaços
 * em branco dentro do valor do atributo (`fromid="38170 "`). */
const ENTRY_RE =
  /<brush\s+name="([^"]*)"\s*\/>|<item\s+fromid="\s*(\d+)\s*"\s*toid="\s*(\d+)\s*"\s*\/>|<item\s+id="\s*(\d+)\s*"\s*toid="\s*(\d+)\s*"\s*\/>|<item\s+id="\s*(\d+)\s*"\s*\/>/g;

function parseCategoryEntries(content: string): TilesetXmlEntry[] {
  const entries: TilesetXmlEntry[] = [];
  let order = 0;
  let match: RegExpExecArray | null;

  ENTRY_RE.lastIndex = 0;
  while ((match = ENTRY_RE.exec(content)) !== null) {
    const [, brushName, rangeFrom, rangeTo, bugId, bugToId, itemId] = match;

    if (brushName != null) {
      entries.push({ type: "brush", name: brushName, order: order++ });
    } else if (rangeFrom != null && rangeTo != null) {
      entries.push({ type: "itemRange", fromId: Number(rangeFrom), toId: Number(rangeTo), order: order++ });
    } else if (bugId != null && bugToId != null) {
      entries.push({ type: "itemRange", fromId: Number(bugId), toId: Number(bugToId), order: order++ });
    } else if (itemId != null) {
      entries.push({ type: "item", itemId: Number(itemId), order: order++ });
    }
  }

  return entries;
}

function parseCategories(tilesetContent: string): TilesetXmlCategory[] {
  const categories: TilesetXmlCategory[] = [];
  let match: RegExpExecArray | null;

  CATEGORY_BLOCK_RE.lastIndex = 0;
  while ((match = CATEGORY_BLOCK_RE.exec(tilesetContent)) !== null) {
    const [, comment, tag, content] = match;
    const kind = TAG_TO_KIND[tag];
    if (!kind) continue;

    categories.push({
      name: comment?.trim() ?? "",
      kind,
      entries: parseCategoryEntries(content),
    });
  }

  return categories;
}

export type ParseTilesetsXmlResult = {
  tilesets: TilesetXmlDocument[];
  errors: string[];
};

/** Faz o parse de um `tilesets.xml` do RME (`<materials><tileset>...</tileset></materials>`). */
export function parseTilesetsXml(xml: string): ParseTilesetsXmlResult {
  const errors: string[] = [];
  const tilesets: TilesetXmlDocument[] = [];

  if (!xml.includes("<materials")) {
    return { tilesets: [], errors: ["XML inválido: elemento raiz <materials> não encontrado."] };
  }

  let match: RegExpExecArray | null;
  TILESET_BLOCK_RE.lastIndex = 0;
  while ((match = TILESET_BLOCK_RE.exec(xml)) !== null) {
    const [, name, content] = match;

    if (!name) {
      errors.push("Encontrada <tileset> sem atributo name — ignorada.");
      continue;
    }

    tilesets.push({ name, categories: parseCategories(content) });
  }

  if (tilesets.length === 0) {
    errors.push("Nenhum <tileset> encontrado dentro de <materials>.");
  }

  return { tilesets, errors };
}
