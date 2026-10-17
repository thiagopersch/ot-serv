import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { requireSiteAdminSession } from "@/lib/api-guard";
import { withAudit } from "@/lib/api-audit-wrapper";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  InvalidServerPathError,
  collectLuaFilesRecursive,
  deleteServerFile,
  inferLuaScriptCategory,
  readServerFile,
  resolveServerPath,
  writeServerFile,
} from "@/lib/server-files";
import {
  collectNpcXmlFilesRecursive,
  deleteNpcByName,
  isNpcXmlRelativePath,
  upsertNpcFromXmlContent,
} from "@/lib/npc-file-sync";

export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireSiteAdminSession();
  if (response) return response;

  const url = new URL(request.url);
  const relativePath = url.searchParams.get("path");

  if (!relativePath) {
    return NextResponse.json({ error: "Informe o caminho do arquivo." }, { status: 422 });
  }

  try {
    const content = await readServerFile(relativePath);
    const category =
      path.extname(relativePath).toLowerCase() === ".lua"
        ? inferLuaScriptCategory(relativePath)
        : null;

    const linkedLuaScript = category
      ? await prisma.luaScript.findUnique({
          where: { name_category: { name: path.basename(relativePath), category } },
          select: { id: true },
        })
      : null;

    return NextResponse.json({
      path: relativePath,
      content,
      category,
      luaScriptId: linkedLuaScript?.id ?? null,
    });
  } catch (error) {
    if (error instanceof InvalidServerPathError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
    }
    throw error;
  }
});

export const PUT = withAudit(async function PUT(request: Request) {
  const { session, response } = await requireSiteAdminSession();
  if (response) return response;

  const body = await request.json().catch(() => null);
  const relativePath = body?.path;
  const content = body?.content;

  if (typeof relativePath !== "string" || !relativePath) {
    return NextResponse.json({ error: "Informe o caminho do arquivo." }, { status: 422 });
  }
  if (typeof content !== "string") {
    return NextResponse.json({ error: "Conteúdo inválido." }, { status: 422 });
  }

  try {
    await writeServerFile(relativePath, content);

    // Um `.lua` dentro de uma pasta de categoria reconhecida (`data/{categoria}/scripts/*.lua`)
    // também sincroniza com a tabela `LuaScript` (por nome+categoria) — outros arquivos (xml,
    // sql, py, ou `.lua` fora de pasta de categoria) só existem em disco, não há tabela
    // genérica de "arquivo" no banco pra eles.
    const category =
      path.extname(relativePath).toLowerCase() === ".lua"
        ? inferLuaScriptCategory(relativePath)
        : null;

    let linkedLuaScriptId: number | null = null;
    if (category) {
      const name = path.basename(relativePath);
      // Não usa `upsert` puro: uma linha soft-deleted continua ocupando a constraint única
      // [name, category], então salvar por cima dela precisa "revivê-la" (limpar `deletedAt`)
      // em vez de colidir tentando criar uma nova.
      const existing = await prisma.luaScript.findUnique({
        where: { name_category: { name, category } },
      });
      const luaScript = existing
        ? await prisma.luaScript.update({
            where: { id: existing.id },
            data: { content, deletedAt: null },
          })
        : await prisma.luaScript.create({ data: { name, content, category } });
      linkedLuaScriptId = luaScript.id;
    }

    // Um `.xml` direto em `data/npc/<nome>.xml` sincroniza com a tabela `Npc` (cria o registro se
    // não existir, ou atualiza os campos que o XML representa se já existir) — mesmo espírito do
    // sync de `.lua` acima, mas pro CRUD de NPCs. Erro de parse não derruba a resposta: o arquivo
    // em disco já foi salvo com sucesso, só o sync com o banco falhou.
    const npcName = isNpcXmlRelativePath(relativePath);
    let syncedNpcId: number | null = null;
    let syncedNpcCreated = false;
    let npcSyncError: string | null = null;

    if (npcName) {
      const result = await upsertNpcFromXmlContent(content);
      if ("error" in result) {
        npcSyncError = result.error;
      } else {
        syncedNpcId = result.npc.id;
        syncedNpcCreated = result.created;
      }
    }

    await logAudit({
      accountId: Number(session.user.id),
      action: "update",
      entity: "server_file",
      entityId: relativePath,
      metadata: { path: relativePath, category, linkedLuaScriptId, syncedNpcId, syncedNpcCreated, npcSyncError },
    });

    return NextResponse.json({ path: relativePath, linkedLuaScriptId, syncedNpcId, syncedNpcCreated, npcSyncError });
  } catch (error) {
    if (error instanceof InvalidServerPathError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
    }
    throw error;
  }
});

export const DELETE = withAudit(async function DELETE(request: Request) {
  const { session, response } = await requireSiteAdminSession();
  if (response) return response;

  const url = new URL(request.url);
  const relativePath = url.searchParams.get("path");

  if (!relativePath) {
    return NextResponse.json({ error: "Informe o caminho do arquivo." }, { status: 422 });
  }

  try {
    const { absolutePath } = resolveServerPath(relativePath);
    const stat = await fs.stat(absolutePath);

    const luaFilePaths = stat.isDirectory()
      ? await collectLuaFilesRecursive(relativePath)
      : path.extname(relativePath).toLowerCase() === ".lua"
        ? [relativePath]
        : [];

    // Espelha a exclusão no banco: apagar `data/npc/<nome>.xml` (arquivo único ou dentro de uma
    // pasta apagada por inteiro) remove o `Npc` correspondente, mesmo comportamento do botão
    // "Excluir" do CRUD (`DELETE /api/admin/npcs/[id]`), só que disparado pelo Explorador.
    const npcXmlPaths = stat.isDirectory()
      ? await collectNpcXmlFilesRecursive(relativePath)
      : (isNpcXmlRelativePath(relativePath) ? [relativePath] : []);

    const deletedNpcIds: number[] = [];
    for (const npcXmlPath of npcXmlPaths) {
      const name = isNpcXmlRelativePath(npcXmlPath);
      if (!name) continue;
      const deletedId = await deleteNpcByName(name);
      if (deletedId != null) deletedNpcIds.push(deletedId);
    }

    const softDeletedLuaScriptIds: number[] = [];

    if (luaFilePaths.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const luaFilePath of luaFilePaths) {
          const category = inferLuaScriptCategory(luaFilePath);
          if (!category) continue;

          const existing = await tx.luaScript.findUnique({
            where: { name_category: { name: path.basename(luaFilePath), category } },
          });
          if (!existing || existing.deletedAt) continue;

          await tx.movement.updateMany({
            where: { luaScriptId: existing.id },
            data: { luaScriptId: null },
          });
          await tx.npc.updateMany({
            where: { scriptId: existing.id },
            data: { scriptId: null },
          });
          await tx.luaScript.update({
            where: { id: existing.id },
            data: { deletedAt: new Date() },
          });
          softDeletedLuaScriptIds.push(existing.id);
        }
      });
    }

    await deleteServerFile(relativePath);

    await logAudit({
      accountId: Number(session.user.id),
      action: "delete",
      entity: "server_file",
      entityId: relativePath,
      metadata: { path: relativePath, softDeletedLuaScriptIds, deletedNpcIds },
    });

    return NextResponse.json({ success: true, softDeletedLuaScriptIds, deletedNpcIds });
  } catch (error) {
    if (error instanceof InvalidServerPathError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
    }
    throw error;
  }
});
