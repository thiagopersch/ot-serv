import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { parseSpellsXml } from "@/lib/spell-xml-parser";
import { spellFormToScalarData } from "@/lib/spell-mapper";
import { withAudit } from "@/lib/api-audit-wrapper";

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const formData = await request.formData();
  const file = formData.get("file");
  const replaceExisting = formData.get("replaceExisting") === "true";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 422 });
  }

  const vocations = await prisma.vocation.findMany({ select: { id: true, name: true } });
  const vocationNameToId = new Map(vocations.map((vocation) => [vocation.name, vocation.id]));

  const xml = await file.text();
  const { spells, errors } = parseSpellsXml(xml, vocationNameToId);

  if (spells.length === 0) {
    return NextResponse.json(
      { error: "Nenhuma spell válida encontrada no arquivo.", details: errors },
      { status: 422 }
    );
  }

  if (replaceExisting) {
    await prisma.spell.deleteMany({});
  }

  // Cada `create` já é atômico (registro + vínculos de vocação); import inteiro NÃO é
  // envolto num único `$transaction` interativo porque, com centenas de spells, o tempo
  // total facilmente estoura o timeout padrão de transação interativa do Prisma (5s),
  // causando um rollback em transação expirada (P2028).
  for (const spell of spells) {
    await prisma.spell.create({
      data: {
        ...spellFormToScalarData(spell),
        vocations: {
          create: spell.vocations.map((vocation) => ({
            vocationId: vocation.vocationId,
            showInDescription: vocation.showInDescription,
          })),
        },
      },
    });
  }

  await logAudit({
    accountId: Number(session.user.id),
    action: "import",
    entity: "spell",
    metadata: { imported: spells.length, skipped: errors.length, replaceExisting },
  });

  return NextResponse.json({
    imported: spells.length,
    skipped: errors.length,
    errors: errors.slice(0, 50),
  });
});
