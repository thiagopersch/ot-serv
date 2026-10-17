import path from "node:path";
import fs from "node:fs/promises";

import { prisma } from "@/lib/prisma";
import { getServerRootPath } from "@/lib/server-files";
import {
  CUSTOM_OUTFIT_STORAGE_BASE,
  CUSTOM_OUTFIT_XML_ID_BASE,
} from "@/lib/validations/admin/custom-outfit";

const BEGIN =
  "<!-- CUSTOM_OUTFITS:BEGIN (gerado por /admin/custom-outfits - não editar à mão) -->";
const END = "<!-- CUSTOM_OUTFITS:END -->";
const BLOCK_REGEX =
  /[ \t]*<!-- CUSTOM_OUTFITS:BEGIN[\s\S]*?<!-- CUSTOM_OUTFITS:END -->/;

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Substitui o bloco gerado (ou insere antes da tag de fechamento / no lugar do comentário
 * legado), preservando o fim de linha do arquivo. */
function replaceBlock(
  content: string,
  lines: string[],
  closingTag: string,
  legacyMarker?: string,
) {
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const block = [
    "\t" + BEGIN,
    ...lines.map((line) => "\t" + line),
    "\t" + END,
  ].join(eol);

  if (BLOCK_REGEX.test(content)) return content.replace(BLOCK_REGEX, block);
  if (legacyMarker && content.includes(legacyMarker)) {
    return content.replace(new RegExp(`[ \\t]*${legacyMarker}`), block);
  }
  const index = content.lastIndexOf(closingTag);
  if (index === -1) throw new Error(`Tag ${closingTag} não encontrada.`);
  return content.slice(0, index) + block + eol + content.slice(index);
}

async function rewrite(
  filePath: string,
  transform: (content: string) => string,
) {
  const content = await fs.readFile(filePath, "utf8");
  const next = transform(content);
  if (next !== content) await fs.writeFile(filePath, next, "utf8");
}

/** Regenera os blocos CUSTOM_OUTFITS em `data/XML/outfits.xml` (outfit sem vocação, liberado
 * pelo storage `61000 + id`) e `data/actions/actions.xml` (item → `custom_outfit_unlock.lua`) a
 * partir dos outfits ativos. O servidor aplica após `/reload outfits` + `/reload actions` ou
 * restart. */
export async function syncCustomOutfitServerFiles(): Promise<void> {
  const outfits = await prisma.customOutfit.findMany({
    where: { active: true },
    orderBy: { id: "asc" },
  });

  const dataPath = path.join(getServerRootPath(), "data");

  const outfitLines = outfits.flatMap((outfit) => [
    `<outfit id="${CUSTOM_OUTFIT_XML_ID_BASE + outfit.id}" type="0" name="${escapeXmlAttr(outfit.name)}" premium="no" storageId="${CUSTOM_OUTFIT_STORAGE_BASE + outfit.id}" storageValue="1">`,
    `\t<list gender="0" looktype="${outfit.lookType}" />`,
    `\t<list gender="1" looktype="${outfit.lookType}" />`,
    `</outfit>`,
  ]);
  await rewrite(path.join(dataPath, "XML", "outfits.xml"), (content) =>
    replaceBlock(
      content,
      outfitLines,
      "</outfits>",
      "<!-- Extra Outfits section -->",
    ),
  );

  const actionLines = outfits.map(
    (outfit) =>
      `<action itemid="${outfit.itemId}" event="script" value="custom_outfit_unlock.lua" />`,
  );
  await rewrite(path.join(dataPath, "actions", "actions.xml"), (content) =>
    replaceBlock(content, actionLines, "</actions>"),
  );
}

/** Sincroniza outfits.xml/actions.xml — falha de disco não desfaz o banco, só avisa. */
export async function trySyncCustomOutfits(): Promise<string | null> {
  try {
    await syncCustomOutfitServerFiles();
    return null;
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Falha ao atualizar os arquivos do servidor.";
  }
}
