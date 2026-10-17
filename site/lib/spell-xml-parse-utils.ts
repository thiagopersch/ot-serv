import { XMLParser } from "fast-xml-parser";

import type { SpellVocationInput } from "@/lib/validations/admin/spell";

export type XmlNode = Record<string, unknown>;

/** Parser dedicado a `spells.xml`: `instant`/`rune`/`conjure`/`vocation` sempre viram array,
 * mesmo com 1 ocorrência só (mesmo motivo do `createXmlParser` de doodads). */
export function createSpellXmlParser() {
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    parseAttributeValue: false,
    trimValues: true,
    commentPropName: "#comment",
    isArray: (name) => ["instant", "rune", "conjure", "vocation"].includes(name),
  });
}

export function str(value: unknown): string {
  return value == null ? "" : String(value);
}

export function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function nullableNum(value: unknown): number | null {
  if (value == null || str(value) === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Os dados reais usam "0"/"1" para bool (não "true"/"false") — aceita as duas formas. */
export function xmlBool(value: unknown): boolean {
  const s = str(value).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

export function asArray(value: unknown): XmlNode[] {
  if (value == null) return [];
  return (Array.isArray(value) ? value : [value]) as XmlNode[];
}

/** Expande listas/ranges de id (`"1,2,3"`, `"1-45"`, `"1-45,47-67"`) — mirror de
 * `parseIntegerVec` (tools.cpp) usado por `parseVocationNode` da engine. */
export function parseIntegerRangeList(input: string): number[] {
  const result: number[] = [];

  for (const part of input.split(",").map((p) => p.trim()).filter(Boolean)) {
    const rangeMatch = part.match(/^(-?\d+)\s*-\s*(-?\d+)$/);

    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      const [lo, hi] = start <= end ? [start, end] : [end, start];
      for (let i = lo; i <= hi; i++) result.push(i);
    } else {
      const n = Number(part);
      if (Number.isFinite(n)) result.push(n);
    }
  }

  return result;
}

export type ParseVocationRefsResult = {
  vocations: SpellVocationInput[];
  errors: string[];
};

/** Faz o parse dos filhos `<vocation id="N|N-M|N,M" />` ou `<vocation name="X" />` de um
 * `<instant>/<rune>/<conjure>`, mirror de `parseVocationNode` (tools.cpp). Nomes são
 * resolvidos contra `vocationNameToId` (case-sensitive, igual ao lookup da engine). IDs são
 * validados contra `validVocationIds` — a tabela `spell_vocations` tem FK para `vocations.id`,
 * então um id sem vocação correspondente no banco quebraria o `prisma.spell.create` inteiro
 * em vez de só pular aquela spell. */
export function parseVocationRefs(
  raw: unknown,
  vocationNameToId: Map<string, number>,
  validVocationIds: Set<number>
): ParseVocationRefsResult {
  const errors: string[] = [];
  const vocations: SpellVocationInput[] = [];

  for (const node of asArray(raw)) {
    const showInDescription = node.showInDescription != null ? xmlBool(node.showInDescription) : true;
    const idAttr = str(node.id);
    const nameAttr = str(node.name);

    if (idAttr !== "") {
      const ids = parseIntegerRangeList(idAttr);
      if (ids.length === 0) {
        errors.push(`vocation id inválido: "${idAttr}"`);
        continue;
      }
      for (const vocationId of ids) {
        if (!validVocationIds.has(vocationId)) {
          errors.push(`vocation id desconhecido: "${vocationId}"`);
          continue;
        }
        vocations.push({ vocationId, showInDescription });
      }
    } else if (nameAttr !== "") {
      const vocationId = vocationNameToId.get(nameAttr);
      if (vocationId == null) {
        errors.push(`vocação desconhecida: "${nameAttr}"`);
        continue;
      }
      vocations.push({ vocationId, showInDescription });
    }
  }

  return { vocations, errors };
}
