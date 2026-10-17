import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { LUA_SCRIPT_CATEGORIES } from "@/lib/validations/admin/lua-script";
import { withAudit } from "@/lib/api-audit-wrapper";

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const formData = await request.formData();
  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File);
  const category = formData.get("category");
  const replaceExisting = formData.get("replaceExisting") === "true";

  if (
    typeof category !== "string" ||
    !LUA_SCRIPT_CATEGORIES.includes(category as never)
  ) {
    return NextResponse.json(
      { error: "Selecione a categoria (pasta de scripts) para importar." },
      { status: 422 },
    );
  }

  if (files.length === 0) {
    return NextResponse.json(
      { error: "Selecione ao menos um arquivo .lua." },
      { status: 422 },
    );
  }

  const batchId = crypto.randomUUID();

  let imported = 0;
  let skipped = 0;
  const skippedFiles: { fileName: string; reason: string }[] = [];

  for (const file of files) {
    if (!file.name.endsWith(".lua")) {
      skipped += 1;
      skippedFiles.push({ fileName: file.name, reason: "Não é um arquivo .lua." });
      continue;
    }

    const content = await file.text();
    const existing = await prisma.luaScript.findUnique({
      where: { name_category: { name: file.name, category } },
    });

    if (existing && !replaceExisting) {
      skipped += 1;
      skippedFiles.push({
        fileName: file.name,
        reason: `Já existe um script com esse nome na categoria "${category}" (marque "substituir" para sobrescrever).`,
      });
      continue;
    }

    // `update` também limpa `deletedAt` — sem isso, importar por cima de um script
    // soft-deleted (com "substituir" marcado) atualizaria o conteúdo mas o script continuaria
    // não aparecendo em lugar nenhum (mesmo problema resolvido em `server-files/content` e em
    // `POST /api/admin/lua-scripts`).
    await prisma.luaScript.upsert({
      where: { name_category: { name: file.name, category } },
      update: { content, category, deletedAt: null },
      create: { name: file.name, content, category },
    });
    imported += 1;
  }

  // Uma linha de auditoria por arquivo ignorado, com o motivo estruturado — mesmo padrão do
  // import de looktypes (`app/api/admin/looktypes/import-log/route.ts`), em lote (`createMany`)
  // para não abrir N inserts em paralelo por request.
  if (skippedFiles.length > 0) {
    await prisma.auditLog.createMany({
      data: skippedFiles.map((entry) => ({
        accountId: Number(session.user.id),
        action: "import_skip",
        entity: "lua_script",
        entityId: entry.fileName.slice(0, 100),
        metadata: { ...entry, category, replaceExisting, batchId },
      })),
    });
  }

  await logAudit({
    accountId: Number(session.user.id),
    action: "import",
    entity: "lua_script",
    metadata: { imported, skipped, category, replaceExisting, batchId },
  });

  return NextResponse.json({
    imported,
    skipped,
    skippedFiles: skippedFiles.slice(0, 50),
    batchId,
  });
});
