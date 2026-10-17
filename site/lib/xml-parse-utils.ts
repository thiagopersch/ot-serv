import { XMLParser } from "fast-xml-parser";

import type { AlternateInput, CompositeInput, ItemRefInput, TileInput } from "@/lib/validations/admin/doodad";

export type XmlNode = Record<string, unknown>;

/** Config compartilhada: nomes que sempre devem virar array, mesmo com 1 ocorrência só. */
export function createXmlParser(extraArrayTags: string[] = []) {
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    parseAttributeValue: false,
    trimValues: true,
    isArray: (name) =>
      [
        "brush",
        "item",
        "alternate",
        "composite",
        "tile",
        "carpet",
        "wall",
        "table",
        "door",
        "friend",
        ...extraArrayTags,
      ].includes(name),
  });
}

export function str(value: unknown): string {
  return value == null ? "" : String(value);
}

export function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function bool(value: unknown): boolean {
  return value === "true" || value === true;
}

export function nullableBool(value: unknown): boolean | null {
  return value == null ? null : bool(value);
}

export function asArray(value: unknown): XmlNode[] {
  if (value == null) return [];
  return (Array.isArray(value) ? value : [value]) as XmlNode[];
}

export function parseItems(raw: unknown): ItemRefInput[] {
  return asArray(raw).map((item) => ({
    id: num(item.id),
    chance: item.chance != null ? num(item.chance) : null,
  }));
}

export function parseTiles(raw: unknown): TileInput[] {
  return asArray(raw).map((tile) => ({
    x: num(tile.x),
    y: num(tile.y),
    z: tile.z != null ? num(tile.z) : null,
    items: parseItems(tile.item),
  }));
}

export function parseComposites(raw: unknown): CompositeInput[] {
  return asArray(raw).map((composite) => ({
    chance: num(composite.chance),
    tiles: parseTiles(composite.tile),
  }));
}

export function parseAlternates(raw: unknown): AlternateInput[] {
  return asArray(raw).map((alternate) => ({
    items: parseItems(alternate.item),
    composites: parseComposites(alternate.composite),
  }));
}
