import type { TilesetXmlCategory, TilesetXmlDocument, TilesetXmlEntry } from "@/lib/validations/admin/tileset";
import { escapeXml, indent } from "@/lib/xml-utils";

const CATEGORY_TAGS: Record<TilesetXmlCategory["kind"], string> = {
  TERRAIN: "terrain",
  TERRAIN_AND_RAW: "terrain_and_raw",
  DOODAD: "doodad",
  DOODAD_AND_RAW: "doodad_and_raw",
  RAW: "raw",
  ITEMS: "items",
  ITEMS_AND_RAW: "items_and_raw",
};

function entryXml(entry: TilesetXmlEntry): string {
  switch (entry.type) {
    case "brush":
      return `<brush name="${escapeXml(entry.name)}" />`;
    case "item":
      return `<item id="${entry.itemId}" />`;
    case "itemRange":
      return `<item fromid="${entry.fromId}" toid="${entry.toId}" />`;
  }
}

export function tilesetCategoryToXml(category: TilesetXmlCategory): string {
  const tag = CATEGORY_TAGS[category.kind];
  const nameComment = category.name ? `<!-- ${escapeXml(category.name)} -->\n` : "";
  const entries = [...category.entries].sort((a, b) => a.order - b.order);

  if (entries.length === 0) {
    return `${nameComment}<${tag}>\n</${tag}>`;
  }

  const lines = entries.map(entryXml);
  return [`${nameComment}<${tag}>`, ...indent(lines, 1), `</${tag}>`].join("\n");
}

export function tilesetToXml(tileset: TilesetXmlDocument): string {
  if (tileset.categories.length === 0) {
    return `<tileset name="${escapeXml(tileset.name)}">\n</tileset>`;
  }

  const body = tileset.categories
    .map((category) =>
      tilesetCategoryToXml(category)
        .split("\n")
        .join("\n")
    )
    .join("\n");

  return [`<tileset name="${escapeXml(tileset.name)}">`, ...indent(body.split("\n"), 1), `</tileset>`].join("\n");
}

export function tilesetsToXmlDocument(tilesets: TilesetXmlDocument[]): string {
  const body = tilesets
    .map((tileset) =>
      tilesetToXml(tileset)
        .split("\n")
        .map((line) => `    ${line}`)
        .join("\n")
    )
    .join("\n\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<materials>\n${body}\n</materials>\n`;
}
