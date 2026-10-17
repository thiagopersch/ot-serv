import type { BorderFormInput } from "@/lib/validations/admin/border";
import { escapeXml, indent } from "@/lib/xml-utils";

export function borderToXml(border: BorderFormInput): string {
  const attrs = [`id="${border.id}"`];
  if (border.group != null) attrs.push(`group="${border.group}"`);
  if (border.optional) attrs.push(`type="optional"`);

  const items = border.edges.filter((edge) => edge.itemId > 0);
  const nameComment = border.name ? ` -- ${escapeXml(border.name)} --` : "";

  if (items.length === 0) {
    return `<border ${attrs.join(" ")}>${nameComment}\n</border>`;
  }

  const lines = items.map((edge) => `<borderitem edge="${edge.edge}" item="${edge.itemId}"/>`);

  return [`<border ${attrs.join(" ")}>${nameComment}`, ...indent(lines, 1), `</border>`].join("\n");
}

export function bordersToXmlDocument(borders: BorderFormInput[]): string {
  const body = borders
    .map((border) =>
      borderToXml(border)
        .split("\n")
        .map((line) => `    ${line}`)
        .join("\n")
    )
    .join("\n\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<materials>\n${body}\n</materials>\n`;
}
