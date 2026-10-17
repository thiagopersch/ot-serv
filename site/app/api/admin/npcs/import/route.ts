import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { parseNpcXml } from "@/lib/npc-xml-parser";
import { writeNpcFiles } from "@/lib/npc-generator";
import { withAudit } from "@/lib/api-audit-wrapper";

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const formData = await request.formData();
  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File);

  const updateExisting = formData.get("replaceExisting") === "true";

  if (files.length === 0) {
    return NextResponse.json(
      { error: "Nenhum arquivo enviado." },
      { status: 422 },
    );
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const file of files) {
    const xml = await file.text();
    const { npc, error } = parseNpcXml(xml);

    if (!npc) {
      skipped += 1;
      errors.push(`${file.name}: ${error ?? "arquivo inválido"}`);
      continue;
    }

    const existing = await prisma.npc.findUnique({ where: { name: npc.name } });

    if (existing && !updateExisting) {
      skipped += 1;
      errors.push(`${file.name}: já existe um NPC chamado "${npc.name}"`);
      continue;
    }

    const { shopItems, customMessages, ...npcFields } = npc;
    const data = {
      ...npcFields,
      shopItems: shopItems.filter((item) => item.direction && item.itemId) as unknown as Prisma.InputJsonValue,
      customMessages: customMessages as unknown as Prisma.InputJsonValue,
    };

    const saved = existing
      ? await prisma.npc.update({ where: { id: existing.id }, data })
      : await prisma.npc.create({ data });

    try {
      await writeNpcFiles(npc);
    } catch (writeError) {
      errors.push(`${file.name}: salvo no banco, mas falhou ao gravar os arquivos: ${String(writeError)}`);
    }

    await logAudit({
      accountId: Number(session.user.id),
      action: "import",
      entity: "npc",
      entityId: saved.id,
      metadata: { name: saved.name, updated: Boolean(existing) },
    });

    imported += 1;
  }

  return NextResponse.json({ imported, skipped, errors: errors.slice(0, 50) });
});
