import { isWallBrushType, type DoodadFormInput } from "@/lib/validations/admin/doodad";
import { alternatesXml, compositesXml, escapeXml, indent, itemTag } from "@/lib/xml-utils";

function doodadContentXml(brush: DoodadFormInput, level: number): string[] {
  const lines: string[] = [];

  lines.push(...indent(brush.items.map(itemTag), level));
  lines.push(...compositesXml(brush.composites, level));
  lines.push(...alternatesXml(brush.alternates, level));

  return lines;
}

function carpetContentXml(brush: DoodadFormInput, level: number): string[] {
  return indent(
    brush.carpets
      .filter((carpet) => carpet.id > 0)
      .map((carpet) => `<carpet align="${carpet.align}" id="${carpet.id}" />`),
    level
  );
}

function wallContentXml(brush: DoodadFormInput, level: number): string[] {
  const lines: string[] = [];

  for (const wall of brush.walls) {
    lines.push(...indent([`<wall type="${escapeXml(wall.type)}">`], level));
    lines.push(...indent(wall.items.map(itemTag), level + 1));
    lines.push(
      ...indent(
        wall.doors.map((door) => {
          const attrs = [`id="${door.id}"`, `type="${door.type}"`, `open="${door.open}"`];
          if (door.hate) attrs.push(`hate="true"`);
          return `<door ${attrs.join(" ")} />`;
        }),
        level + 1
      )
    );
    lines.push(...indent(["</wall>"], level));
  }

  return lines;
}

function tableContentXml(brush: DoodadFormInput, level: number): string[] {
  const lines: string[] = [];

  for (const table of brush.tables) {
    lines.push(...indent([`<table align="${table.align}">`], level));
    lines.push(...indent(table.items.map(itemTag), level + 1));
    lines.push(...indent(["</table>"], level));
  }

  return lines;
}

export function doodadToXml(brush: DoodadFormInput): string {
  const attrs = [
    `name="${escapeXml(brush.name)}"`,
    `type="${brush.type}"`,
    `server_lookid="${brush.serverLookId}"`,
  ];

  if (brush.draggable) attrs.push(`draggable="true"`);
  if (brush.onBlocking) attrs.push(`on_blocking="true"`);
  if (brush.thickness) attrs.push(`thickness="${brush.thickness}"`);
  if (brush.onDuplicate) attrs.push(`on_duplicate="true"`);
  if (brush.oneSize) attrs.push(`one_size="true"`);
  if (brush.redoBorders) attrs.push(`redo_borders="true"`);
  if (brush.reborder) attrs.push(`reborder="true"`);

  const contentLines =
    brush.type === "doodad"
      ? doodadContentXml(brush, 1)
      : brush.type === "carpet"
        ? carpetContentXml(brush, 1)
        : isWallBrushType(brush.type)
          ? wallContentXml(brush, 1)
          : tableContentXml(brush, 1);

  if (contentLines.length === 0) {
    return `<brush ${attrs.join(" ")} />`;
  }

  return [`<brush ${attrs.join(" ")}>`, ...contentLines, `</brush>`].join("\n");
}

export function doodadsToXmlDocument(brushes: DoodadFormInput[]): string {
  const body = brushes
    .map((brush) =>
      doodadToXml(brush)
        .split("\n")
        .map((line) => `    ${line}`)
        .join("\n")
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<materials>\n${body}\n</materials>\n`;
}
