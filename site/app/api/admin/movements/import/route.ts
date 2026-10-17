import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { parseMovementsXml } from "@/lib/movement-xml-parser";
import { movementFormToRow } from "@/lib/movement-mapper";
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

  const xml = await file.text();
  const { movements, errors } = parseMovementsXml(xml);

  if (movements.length === 0) {
    return NextResponse.json(
      { error: "Nenhum movevent válido encontrado no arquivo.", details: errors },
      { status: 422 }
    );
  }

  if (replaceExisting) {
    await prisma.movement.deleteMany({});
  }

  for (const movement of movements) {
    await prisma.movement.create({
      data: {
        ...movementFormToRow(movement),
        vocations: { create: movement.vocations.map((v) => ({ vocationId: v.vocationId })) },
      },
    });
  }

  await logAudit({
    accountId: Number(session.user.id),
    action: "import",
    entity: "movement",
    metadata: { imported: movements.length, skipped: errors.length, replaceExisting },
  });

  return NextResponse.json({
    imported: movements.length,
    skipped: errors.length,
    errors: errors.slice(0, 50),
  });
});
