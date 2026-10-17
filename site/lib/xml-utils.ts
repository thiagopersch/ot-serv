import type { AlternateInput, CompositeInput, ItemRefInput, TileInput } from "@/lib/validations/admin/doodad";

export function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function indent(lines: string[], level: number) {
  const pad = "    ".repeat(level);
  return lines.map((line) => `${pad}${line}`);
}

export function itemTag(item: ItemRefInput) {
  return item.chance != null
    ? `<item id="${item.id}" chance="${item.chance}" />`
    : `<item id="${item.id}" />`;
}

export function tilesXml(tiles: TileInput[], level: number): string[] {
  const lines: string[] = [];

  for (const tile of tiles) {
    const attrs = [`x="${tile.x}"`, `y="${tile.y}"`];
    if (tile.z != null) attrs.push(`z="${tile.z}"`);

    if (tile.items.length === 0) {
      lines.push(...indent([`<tile ${attrs.join(" ")} />`], level));
      continue;
    }

    lines.push(...indent([`<tile ${attrs.join(" ")}>`], level));
    lines.push(...indent(tile.items.map(itemTag), level + 1));
    lines.push(...indent(["</tile>"], level));
  }

  return lines;
}

export function compositesXml(composites: CompositeInput[], level: number): string[] {
  const lines: string[] = [];

  for (const composite of composites) {
    const attrs = composite.chance ? ` chance="${composite.chance}"` : "";
    lines.push(...indent([`<composite${attrs}>`], level));
    lines.push(...tilesXml(composite.tiles, level + 1));
    lines.push(...indent(["</composite>"], level));
  }

  return lines;
}

export function alternatesXml(alternates: AlternateInput[], level: number): string[] {
  const lines: string[] = [];

  for (const alternate of alternates) {
    lines.push(...indent(["<alternate>"], level));
    lines.push(...indent(alternate.items.map(itemTag), level + 1));
    lines.push(...compositesXml(alternate.composites, level + 1));
    lines.push(...indent(["</alternate>"], level));
  }

  return lines;
}
