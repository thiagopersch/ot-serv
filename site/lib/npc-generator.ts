import fs from "node:fs/promises";
import path from "node:path";

import { prisma } from "@/lib/prisma";
import type { NpcInput } from "@/lib/validations/admin/npc";
import { buildNpcXml, needsOwnScript, resolveScriptContent, resolveScriptFile } from "@/lib/npc-xml";

export { buildNpcXml };

export function getNpcDataPath(): string {
  const base = process.env.OTSERVER_DATA_PATH;
  if (!base) {
    throw new Error("OTSERVER_DATA_PATH não configurado (.env)");
  }
  return base;
}

/**
 * Grava data/npc/{name}.xml (e data/npc/scripts/{name}.lua quando não é NPC de venda) no
 * servidor OTServer. Efeito colateral explícito de POST/PATCH em /api/admin/npcs — NPCs são
 * carregados pelo C++ a partir desses arquivos no boot (ver Npcs::loadFromXml), então não dá
 * para manter só no banco como o resto do admin (tasks/lua-scripts).
 *
 * O conteúdo do script Lua vem do cadastro de Script Lua (`npc.scriptId`) — o NPC só referencia
 * um script já existente, não escreve conteúdo próprio. Exceção: NPCs "shop" sem `scriptId`
 * usam o `default.lua` de estoque do servidor e não têm arquivo próprio gravado.
 */
export async function writeNpcFiles(npc: NpcInput): Promise<void> {
  const dataPath = getNpcDataPath();
  const looktype = await prisma.looktype.findUnique({
    where: { id: npc.lookTypeId },
    select: { looktypeNumber: true },
  });
  const linkedScript = npc.scriptId
    ? await prisma.luaScript.findUnique({ where: { id: npc.scriptId }, select: { content: true, name: true } })
    : null;

  const xmlPath = path.join(dataPath, "npc", `${npc.name}.xml`);
  await fs.writeFile(
    xmlPath,
    buildNpcXml(npc, looktype?.looktypeNumber ?? null, linkedScript?.name ?? null),
    "utf-8",
  );

  if (needsOwnScript(npc)) {
    const scriptsDir = path.join(dataPath, "npc", "scripts");
    // Com `scriptId` vinculado, grava sob o nome real do script (compartilhado entre NPCs que
    // referenciam o mesmo `LuaScript`, sempre com o mesmo conteúdo) em vez de renomear pro nome
    // do NPC — `path.basename` sanitiza contra `LuaScript.name` com separadores de diretório
    // (campo de texto livre no CRUD simples, sem I/O próprio que force essa convenção).
    const scriptFileName = path.basename(resolveScriptFile(npc, linkedScript?.name, `${npc.name}.lua`));
    const scriptPath = path.join(scriptsDir, scriptFileName);
    await fs.mkdir(scriptsDir, { recursive: true });

    const scriptContent = resolveScriptContent(npc, linkedScript?.content);
    if (scriptContent) await fs.writeFile(scriptPath, scriptContent, "utf-8");
  }
}

export async function deleteNpcFiles(name: string): Promise<void> {
  const dataPath = getNpcDataPath();
  await fs.rm(path.join(dataPath, "npc", `${name}.xml`), { force: true });
  await fs.rm(path.join(dataPath, "npc", "scripts", `${name}.lua`), { force: true });
}
