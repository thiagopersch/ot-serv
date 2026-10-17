import { promises as fs } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { MAX_IMAGE_BYTES, detectImageExtension, entityImageStoragePath } from "@/lib/entity-image";
import { withAudit } from "@/lib/api-audit-wrapper";

/** Upload em lote das imagens de health/mana bar (ex.: a pasta `cliente/data/images/bars`
 * inteira): cada arquivo vira a imagem de todos os registros healthbars/manabars cujo atributo
 * `image` termina no mesmo nome (sem extensão, case-insensitive) — `Akatsuki.png` →
 * `/images/bars/Akatsuki`. */
export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const formData = await request.formData();
  const files = formData.getAll("files").filter((value): value is File => value instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 422 });
  }

  const bars = await prisma.extOutfit.findMany({
    where: { kind: { in: ["healthbars", "manabars"] }, image: { not: null } },
    select: { id: true, image: true },
  });
  const idsByStem = new Map<string, number[]>();
  for (const bar of bars) {
    const stem = (bar.image ?? "").replace(/^.*\//, "").replace(/\.(png|gif)$/i, "").toLowerCase();
    idsByStem.set(stem, [...(idsByStem.get(stem) ?? []), bar.id]);
  }

  const unmatched: string[] = [];
  const invalid: string[] = [];
  let matchedFiles = 0;
  let updatedRecords = 0;

  for (const file of files) {
    const fileName = file.name.replace(/^.*[\\/]/, "");
    const ids = idsByStem.get(fileName.replace(/\.[^.]+$/, "").toLowerCase());
    if (!ids?.length) {
      unmatched.push(fileName);
      continue;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const extension = detectImageExtension(buffer);
    if (!extension || buffer.length > MAX_IMAGE_BYTES) {
      invalid.push(fileName);
      continue;
    }

    for (const id of ids) {
      const existing = await prisma.entityImage.findUnique({
        where: { entityType_entityId: { entityType: "extoutfit", entityId: id } },
      });
      if (existing && existing.extension !== extension) {
        await fs.unlink(entityImageStoragePath("extoutfit", id, existing.extension)).catch(() => null);
      }
      const storagePath = entityImageStoragePath("extoutfit", id, extension);
      await fs.mkdir(path.dirname(storagePath), { recursive: true });
      await fs.writeFile(storagePath, buffer);
      await prisma.entityImage.upsert({
        where: { entityType_entityId: { entityType: "extoutfit", entityId: id } },
        update: { extension },
        create: { entityType: "extoutfit", entityId: id, extension },
      });
    }
    matchedFiles++;
    updatedRecords += ids.length;
  }

  await logAudit({
    accountId: Number(session.user.id),
    action: "import",
    entity: "extoutfit_image",
    metadata: { matchedFiles, updatedRecords, unmatched: unmatched.length, invalid },
  });

  return NextResponse.json({ matchedFiles, updatedRecords, unmatched, invalid });
});
