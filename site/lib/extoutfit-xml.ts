import { escapeXml } from "@/lib/xml-utils";
import {
  EXTOUTFIT_KINDS,
  extOutfitValueField,
  type ExtOutfitKind,
} from "@/lib/validations/admin/extoutfit";

/** Dados mínimos para gerar uma entrada do `extoutfits.xml` — `looktypeNumber` já resolvido a
 * partir do cadastro (`looktypes.looktype_number`). */
export type ExtOutfitXmlData = {
  kind: string;
  xmlId: number;
  name: string;
  looktypeNumber: number | null;
  shaderName: string | null;
  image: string | null;
  posx: number | null;
  posy: number | null;
};

const SECTION_HEADERS: Record<ExtOutfitKind, string[]> = {
  wings: [
    "<!-- ========== WINGS ========== -->",
    "<!-- lookType = sprite ID no .dat, deve ser ThingCategoryCreature -->",
    "<!-- storageId/storageValue = se vazio, todos os players tem acesso -->",
  ],
  auras: ["<!-- ========== AURAS ========== -->"],
  shaders: [
    "<!-- ========== SHADERS ========== -->",
    "<!-- shadername = nome registrado via g_shaders.createOutfitShader no cliente -->",
  ],
  healthbars: [
    "<!-- ========== HEALTH BARS ========== -->",
    "<!-- image = path da imagem no cliente (sem extensao) -->",
  ],
  manabars: ["<!-- ========== MANA BARS ========== -->"],
};

/** Uma linha `<wings|auras|shaders|healthbars|manabars ... />` no formato do arquivo original
 * (id, atributo da aparência, name, posx/posy opcionais). */
export function extOutfitToXml(entry: ExtOutfitXmlData): string {
  const kind = entry.kind as ExtOutfitKind;
  const attrs = [`id="${entry.xmlId}"`];
  const field = extOutfitValueField(kind);

  if (field === "looktype") attrs.push(`looktype="${entry.looktypeNumber ?? 0}"`);
  else if (field === "shadername") attrs.push(`shadername="${escapeXml(entry.shaderName ?? "")}"`);
  else attrs.push(`image="${escapeXml(entry.image ?? "")}"`);

  attrs.push(`name="${escapeXml(entry.name)}"`);
  if (entry.posx != null) attrs.push(`posx="${entry.posx}"`);
  if (entry.posy != null) attrs.push(`posy="${entry.posy}"`);

  return `  <${kind} ${attrs.join(" ")} />`;
}

/** Documento completo, agrupado por tag na ordem wings -> auras -> shaders -> healthbars ->
 * manabars, com os comentários de seção do arquivo original. Tags sem entradas são omitidas. */
export function extOutfitsToXmlDocument(entries: ExtOutfitXmlData[]): string {
  const lines = [`<?xml version="1.0" encoding="UTF-8"?>`, `<extoutfits>`];

  for (const kind of EXTOUTFIT_KINDS) {
    const ofKind = entries.filter((entry) => entry.kind === kind).sort((a, b) => a.xmlId - b.xmlId);
    if (ofKind.length === 0) continue;
    lines.push("", ...SECTION_HEADERS[kind].map((line) => `  ${line}`), ...ofKind.map(extOutfitToXml));
  }

  lines.push("", `</extoutfits>`, "");
  return lines.join("\n");
}
