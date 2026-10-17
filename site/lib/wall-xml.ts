import { resolveContentMode, type WallFormInput } from "@/lib/validations/admin/wall";
import { alternatesXml, compositesXml, escapeXml, indent, itemTag } from "@/lib/xml-utils";

function doodadContentXml(brush: WallFormInput, level: number): string[] {
  const lines: string[] = [];

  lines.push(...indent(brush.items.map(itemTag), level));
  lines.push(...compositesXml(brush.composites, level));
  lines.push(...alternatesXml(brush.alternates, level));

  return lines;
}

function wallContentXml(brush: WallFormInput, level: number): string[] {
  const lines: string[] = [];

  for (const wall of brush.walls) {
    lines.push(...indent([`<wall type="${escapeXml(wall.type)}">`], level));
    lines.push(...indent(wall.items.map(itemTag), level + 1));
    lines.push(
      ...indent(
        wall.doors.map((door) => {
          const attrs = [`id="${door.id}"`, `type="${escapeXml(door.type)}"`];
          if (door.open != null) attrs.push(`open="${door.open}"`);
          if (door.locked) attrs.push(`locked="true"`);
          return `<door ${attrs.join(" ")} />`;
        }),
        level + 1
      )
    );
    lines.push(...indent(["</wall>"], level));
  }

  return lines;
}

function friendsXml(brush: WallFormInput, level: number): string[] {
  return indent(
    brush.friends.map((friend) => {
      const attrs = [`name="${escapeXml(friend.name)}"`];
      if (friend.redirect) attrs.push(`redirect="true"`);
      return `<friend ${attrs.join(" ")} />`;
    }),
    level
  );
}

export function wallBrushToXml(brush: WallFormInput): string {
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
    resolveContentMode(brush) === "wall" ? wallContentXml(brush, 1) : doodadContentXml(brush, 1);

  const allLines = [...contentLines, ...friendsXml(brush, 1)];

  if (allLines.length === 0) {
    return `<brush ${attrs.join(" ")} />`;
  }

  return [`<brush ${attrs.join(" ")}>`, ...allLines, `</brush>`].join("\n");
}

export function wallsToXmlDocument(brushes: WallFormInput[]): string {
  const body = brushes
    .map((brush) =>
      wallBrushToXml(brush)
        .split("\n")
        .map((line) => `    ${line}`)
        .join("\n")
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<materials>\n${body}\n</materials>\n`;
}
