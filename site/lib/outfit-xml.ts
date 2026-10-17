import { escapeXml } from "@/lib/xml-utils";

/** Dados mínimos para gerar uma `<outfit>` — números das looktypes já resolvidos a partir do
 * cadastro (`looktypes.looktype_number`). */
export type OutfitXmlData = {
  id: number;
  name: string;
  type: number;
  premium: boolean;
  storageId: string | null;
  storageValue: string | null;
  maleLooktypeNumber: number | null;
  femaleLooktypeNumber: number | null;
  extraAttributes?: Record<string, string> | null;
};

/** `<outfit>` no mesmo formato do `server/data/XML/outfits.xml` (tab, `premium="yes|no"`,
 * `<list gender="0">` feminino antes do `gender="1"` masculino). storageId/storageValue só saem
 * quando preenchidos. */
export function outfitToXml(outfit: OutfitXmlData): string {
  const attrs = [
    `id="${outfit.id}"`,
    `type="${outfit.type}"`,
    `name="${escapeXml(outfit.name)}"`,
    `premium="${outfit.premium ? "yes" : "no"}"`,
  ];

  for (const [key, value] of Object.entries(outfit.extraAttributes ?? {})) {
    attrs.push(`${key}="${escapeXml(String(value))}"`);
  }

  if (outfit.storageId) {
    attrs.push(`storageId="${escapeXml(outfit.storageId)}"`);
    if (outfit.storageValue) attrs.push(`storageValue="${escapeXml(outfit.storageValue)}"`);
  }

  return [
    `\t<outfit ${attrs.join(" ")}>`,
    `\t\t<list gender="0" looktype="${outfit.femaleLooktypeNumber ?? 0}" />`,
    `\t\t<list gender="1" looktype="${outfit.maleLooktypeNumber ?? 0}" />`,
    `\t</outfit>`,
  ].join("\n");
}

export function outfitsToXmlDocument(outfits: OutfitXmlData[]): string {
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<outfits>`,
    ...outfits.map(outfitToXml),
    `</outfits>`,
    "",
  ].join("\n");
}
