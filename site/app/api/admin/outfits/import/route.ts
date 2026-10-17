import { NextResponse } from "next/server";
import { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { parseOutfitsXml } from "@/lib/outfit-xml-parser";
import { resolveOrCreateOutfitLooktypes } from "@/lib/looktype-resolve";
import { withAudit } from "@/lib/api-audit-wrapper";

/** Importa o `outfits.xml` do servidor. Looktypes que ainda não existem no cadastro
 * (`/admin/looktypes`, category="outfit") são criadas; outfits com id já cadastrado só são
 * sobrescritas com `replaceExisting=true` (senão contam como ignoradas). O item de desbloqueio
 * não vem do XML e é preservado nas outfits substituídas. */
export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const formData = await request.formData();
  const file = formData.get("file");
  const replaceExisting = formData.get("replaceExisting") === "true";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 422 });
  }

  const { outfits, errors } = parseOutfitsXml(await file.text());
  if (outfits.length === 0) {
    return NextResponse.json(
      { error: "Nenhuma outfit válida encontrada no arquivo.", details: errors.slice(0, 50) },
      { status: 422 },
    );
  }

  const existingIds = new Set(
    (
      await prisma.outfitDefinition.findMany({
        where: { id: { in: outfits.map((outfit) => outfit.id) } },
        select: { id: true },
      })
    ).map((row) => row.id),
  );
  const toWrite = replaceExisting ? outfits : outfits.filter((outfit) => !existingIds.has(outfit.id));
  const skipped = outfits.length - toWrite.length;

  const looktypeNames = new Map<number, string>();
  for (const outfit of toWrite) {
    if (!looktypeNames.has(outfit.maleLooktypeNumber)) looktypeNames.set(outfit.maleLooktypeNumber, outfit.name);
    if (!looktypeNames.has(outfit.femaleLooktypeNumber)) looktypeNames.set(outfit.femaleLooktypeNumber, outfit.name);
  }

  const { createdLooktypes, created, updated } = await prisma.$transaction(
    async (tx) => {
      const { idByNumber, created: createdLooktypes } = await resolveOrCreateOutfitLooktypes(tx, looktypeNames);
      let created = 0;
      let updated = 0;

      for (const outfit of toWrite) {
        const data = {
          name: outfit.name,
          type: outfit.type,
          premium: outfit.premium,
          storageId: outfit.storageId,
          storageValue: outfit.storageValue,
          maleLooktypeId: idByNumber.get(outfit.maleLooktypeNumber)!,
          femaleLooktypeId: idByNumber.get(outfit.femaleLooktypeNumber)!,
          extraAttributes: outfit.extraAttributes ?? Prisma.DbNull,
        };

        if (existingIds.has(outfit.id)) {
          await tx.outfitDefinition.update({ where: { id: outfit.id }, data });
          updated++;
        } else {
          await tx.outfitDefinition.create({ data: { id: outfit.id, ...data } });
          created++;
        }
      }

      return { createdLooktypes, created, updated };
    },
    { timeout: 120_000, maxWait: 10_000 },
  );

  await logAudit({
    accountId: Number(session.user.id),
    action: "import",
    entity: "outfit",
    metadata: { created, updated, skipped, createdLooktypes, invalid: errors.length, replaceExisting },
  });

  return NextResponse.json({
    imported: created + updated,
    created,
    updated,
    skipped: skipped + errors.length,
    createdLooktypes,
    errors: errors.slice(0, 50),
  });
});
