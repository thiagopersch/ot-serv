import fs from "node:fs/promises";
import path from "node:path";

import type { Npc, Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getNpcDataPath } from "@/lib/npc-generator";
import { parseNpcXml } from "@/lib/npc-xml-parser";
import { resolveServerPath } from "@/lib/server-files";
import type { NpcInput } from "@/lib/validations/admin/npc";

/** Margem de tolerância entre o `mtime` do arquivo e `Npc.updatedAt` — evita reconciliar de novo
 * por causa de diferença de resolução entre o relógio do FS e o timestamp do banco (o próprio
 * `prisma.npc.update` da reconciliação grava um `updatedAt` que pode ficar alguns ms atrás do
 * `mtime` do `fs.writeFile` que originou a leitura). */
const RECONCILE_SKEW_MS = 1000;

export function getNpcXmlPath(name: string): string {
  return path.join(getNpcDataPath(), "npc", `${name}.xml`);
}

/** Campos que o XML de fato representa — únicos que a reconciliação disco→banco pode sobrescrever.
 * `lookTypeId`, `town`, `posX/Y/Z`, `direction`, `scriptId`, `customMessages`, `published` não
 * existem no XML (só no banco) e nunca são tocados aqui, senão toda reconciliação apagaria esses
 * campos de volta pro default do parser (ver `parseNpcXml`). */
function buildXmlDerivedUpdate(parsed: NpcInput, currentType: string): Prisma.NpcUpdateInput {
  return {
    walkinterval: parsed.walkinterval,
    lookHead: parsed.lookHead,
    lookBody: parsed.lookBody,
    lookLegs: parsed.lookLegs,
    lookFeet: parsed.lookFeet,
    lookAddons: parsed.lookAddons,
    shopItems: parsed.shopItems.filter((item) => item.direction && item.itemId) as unknown as Prisma.InputJsonValue,
    defaultMessages: parsed.defaultMessages as unknown as Prisma.InputJsonValue,
    // Só promove pra "shop" — o XML não tem como distinguir "quest" de "misc", então nunca
    // rebaixa um tipo já definido no banco.
    type: parsed.type === "shop" ? "shop" : currentType,
  };
}

/**
 * Reconcilia um `Npc` já carregado do banco com o `data/npc/{nome}.xml` correspondente: se o
 * arquivo foi modificado depois do último `updatedAt` do banco, relê e aplica só os campos que o
 * XML representa (ver `buildXmlDerivedUpdate`), persistindo no banco. Se o arquivo não existir ou
 * não estiver mais novo, devolve o `npc` original sem tocar no banco.
 */
export async function reconcileNpcFromDisk<T extends Npc>(npc: T): Promise<T> {
  const xmlPath = getNpcXmlPath(npc.name);

  let stat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stat = await fs.stat(xmlPath);
  } catch {
    return npc;
  }

  if (stat.mtime.getTime() <= npc.updatedAt.getTime() + RECONCILE_SKEW_MS) {
    return npc;
  }

  try {
    const xml = await fs.readFile(xmlPath, "utf-8");
    const { npc: parsed, error } = parseNpcXml(xml);
    if (!parsed) {
      console.warn(`[npc-file-sync] Falha ao reconciliar "${npc.name}" a partir do disco: ${error}`);
      return npc;
    }

    const updated = await prisma.npc.update({
      where: { id: npc.id },
      data: buildXmlDerivedUpdate(parsed, npc.type),
    });

    return { ...npc, ...updated } as T;
  } catch (error) {
    console.warn(`[npc-file-sync] Erro ao reconciliar "${npc.name}" a partir do disco:`, error);
    return npc;
  }
}

export async function reconcileNpcsFromDisk<T extends Npc>(npcs: T[]): Promise<T[]> {
  return Promise.all(npcs.map((npc) => reconcileNpcFromDisk(npc)));
}

/** Dado um caminho relativo à raiz do servidor (formato usado pelo Explorador de arquivos, ex.
 * `data\npc\Razo.xml` no Windows ou `data/npc/Razo.xml`), devolve o nome do NPC (`"Razo"`) se o
 * caminho apontar direto pra `data/npc/<nome>.xml` — não dentro de `scripts/`, não aninhado em
 * subpastas. Devolve `null` caso contrário (mesmo padrão de normalização de
 * `inferLuaScriptCategory` em `lib/server-files.ts`). */
export function isNpcXmlRelativePath(relativePath: string): string | null {
  const segments = relativePath.split(/[\\/]/).filter(Boolean);
  if (segments.length !== 3) return null;

  const [dataSegment, npcSegment, fileSegment] = segments;
  if (dataSegment.toLowerCase() !== "data") return null;
  if (npcSegment.toLowerCase() !== "npc") return null;
  if (path.extname(fileSegment).toLowerCase() !== ".xml") return null;

  return path.basename(fileSegment, path.extname(fileSegment));
}

/** Percorre recursivamente uma pasta coletando o caminho relativo de todo `data/npc/*.xml`
 * encontrado diretamente dentro de uma pasta `npc` (nunca dentro de `npc/scripts`) — usado antes
 * de apagar uma pasta inteira pelo Explorador, mesmo padrão de `collectLuaFilesRecursive`. */
export async function collectNpcXmlFilesRecursive(relativePath: string): Promise<string[]> {
  const { absolutePath } = resolveServerPath(relativePath);
  const dirents = await fs.readdir(absolutePath, { withFileTypes: true });

  const npcXmlFiles: string[] = [];

  for (const dirent of dirents) {
    if (dirent.isSymbolicLink()) continue;

    const entryRelativePath = path.join(relativePath, dirent.name);

    if (dirent.isDirectory()) {
      npcXmlFiles.push(...(await collectNpcXmlFilesRecursive(entryRelativePath)));
    } else if (dirent.isFile() && isNpcXmlRelativePath(entryRelativePath)) {
      npcXmlFiles.push(entryRelativePath);
    }
  }

  return npcXmlFiles;
}

/**
 * Cria ou atualiza o `Npc` correspondente a partir de um conteúdo de XML recém-salvo pelo
 * Explorador de arquivos. Não chama `writeNpcFiles` depois — reescreveria o arquivo que o admin
 * acabou de editar à mão (e um NPC recém-criado por aqui tem `lookTypeId: 0`, que quebraria o
 * bloco `<look>` gerado). Campos DB-only (`lookTypeId`, `town`, posição, `scriptId`,
 * `customMessages`, `published`) recebem os defaults do parser só na criação; numa atualização,
 * são preservados do registro existente (ver `buildXmlDerivedUpdate`).
 */
export async function upsertNpcFromXmlContent(
  xmlContent: string,
): Promise<{ npc: Npc; created: boolean } | { error: string }> {
  const { npc: parsed, error } = parseNpcXml(xmlContent);
  if (!parsed) {
    return { error: error ?? "XML de NPC inválido." };
  }

  const existing = await prisma.npc.findUnique({ where: { name: parsed.name } });

  if (existing) {
    const updated = await prisma.npc.update({
      where: { id: existing.id },
      data: buildXmlDerivedUpdate(parsed, existing.type),
    });
    return { npc: updated, created: false };
  }

  const { shopItems, customMessages, ...npcFields } = parsed;
  const created = await prisma.npc.create({
    data: {
      ...npcFields,
      shopItems: shopItems.filter((item) => item.direction && item.itemId) as unknown as Prisma.InputJsonValue,
      customMessages: customMessages as unknown as Prisma.InputJsonValue,
      defaultMessages: parsed.defaultMessages as unknown as Prisma.InputJsonValue,
    },
  });
  return { npc: created, created: true };
}

/** Apaga o `Npc` correspondente a um `data/npc/{nome}.xml` removido pelo Explorador de arquivos —
 * espelha `deleteNpcFiles` (banco → disco) na direção inversa. Engole "não encontrado" (o arquivo
 * pode nunca ter tido um registro no banco). */
export async function deleteNpcByName(name: string): Promise<number | null> {
  try {
    const deleted = await prisma.npc.delete({ where: { name } });
    return deleted.id;
  } catch (error) {
    if ((error as { code?: string }).code === "P2025") return null;
    throw error;
  }
}
