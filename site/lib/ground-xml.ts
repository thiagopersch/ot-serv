import type { GroundFormInput } from "@/lib/validations/admin/ground";
import { escapeXml, indent, itemTag } from "@/lib/xml-utils";

export function groundToXml(ground: GroundFormInput): string {
  const attrs = [`name="${escapeXml(ground.name)}"`, `type="ground"`];

  if (ground.serverLookId > 0) attrs.push(`server_lookid="${ground.serverLookId}"`);
  if (ground.zOrder > 0) attrs.push(`z-order="${ground.zOrder}"`);
  if (ground.soloOptional) attrs.push(`solo_optional="true"`);

  const lines: string[] = [];
  lines.push(...ground.items.map(itemTag));

  for (const border of ground.borders) {
    const borderAttrs = [`align="${border.align}"`];
    if (border.to != null) borderAttrs.push(`to="${escapeXml(border.to)}"`);
    borderAttrs.push(`id="${border.borderId}"`);
    lines.push(`<border ${borderAttrs.join(" ")} />`);
  }

  for (const friend of ground.friends) {
    lines.push(`<friend name="${escapeXml(friend.name)}" />`);
  }

  if (lines.length === 0) {
    return `<brush ${attrs.join(" ")} />`;
  }

  return [`<brush ${attrs.join(" ")}>`, ...indent(lines, 1), `</brush>`].join("\n");
}

export function groundsToXmlDocument(grounds: GroundFormInput[]): string {
  const body = grounds
    .map((ground) =>
      groundToXml(ground)
        .split("\n")
        .map((line) => `    ${line}`)
        .join("\n")
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<materials>\n${body}\n</materials>\n`;
}
