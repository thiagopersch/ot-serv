import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { parseExtOutfitsXml } from "@/lib/extoutfit-xml-parser";
import { resolveOrCreateOutfitLooktypes } from "@/lib/looktype-resolve";
import { withAudit } from "@/lib/api-audit-wrapper";

/** Importa o `extoutfits.xml` do servidor. Looktypes de wings/auras que ainda não existem no
 * cadastro (`/admin/looktypes`, category="outfit") são criadas; entradas com o mesmo
 * (tag, id) já cadastradas só são sobrescritas com `replaceExisting=true`. */
export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const formData = await request.formData();
  const file = formData.get("file");
  const replaceExisting = formData.get("replaceExisting") === "true";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 422 });
  }

  const { entries, errors } = parseExtOutfitsXml(await file.text());
  if (entries.length === 0) {
    return NextResponse.json(
      { error: "Nenhuma entrada válida encontrada no arquivo.", details: errors.slice(0, 50) },
      { status: 422 },
    );
  }

  const existing = await prisma.extOutfit.findMany({ select: { id: true, kind: true, xmlId: true } });
  const existingByKey = new Map(existing.map((row) => [`${row.kind}:${row.xmlId}`, row.id]));
  const toWrite = replaceExisting
    ? entries
    : entries.filter((entry) => !existingByKey.has(`${entry.kind}:${entry.xmlId}`));
  const skipped = entries.length - toWrite.length;

  const looktypeNames = new Map<number, string>();
  for (const entry of toWrite) {
    if (entry.looktypeNumber !== null && !looktypeNames.has(entry.looktypeNumber)) {
      looktypeNames.set(entry.looktypeNumber, entry.name);
    }
  }

  const { createdLooktypes, created, updated } = await prisma.$transaction(
    async (tx) => {
      const { idByNumber, created: createdLooktypes } = await resolveOrCreateOutfitLooktypes(tx, looktypeNames);
      let created = 0;
      let updated = 0;

      for (const entry of toWrite) {
        const data = {
          kind: entry.kind,
          xmlId: entry.xmlId,
          name: entry.name,
          // Shaders/bars não têm looktype no XML — preserva a sprite de preview já vinculada.
          ...(entry.looktypeNumber !== null ? { looktypeId: idByNumber.get(entry.looktypeNumber)! } : {}),
          shaderName: entry.shaderName,
          image: entry.image,
          posx: entry.posx,
          posy: entry.posy,
        };

        const existingId = existingByKey.get(`${entry.kind}:${entry.xmlId}`);
        if (existingId !== undefined) {
          await tx.extOutfit.update({ where: { id: existingId }, data });
          updated++;
        } else {
          await tx.extOutfit.create({ data });
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
    entity: "extoutfit",
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
