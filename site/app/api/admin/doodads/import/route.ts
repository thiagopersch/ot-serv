import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { parseDoodadsXml } from "@/lib/doodad-xml-parser";
import { doodadFormToContent } from "@/lib/doodad-mapper";
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
  const { brushes, errors } = parseDoodadsXml(xml);

  if (brushes.length === 0) {
    return NextResponse.json(
      { error: "Nenhum brush válido encontrado no arquivo.", details: errors },
      { status: 422 }
    );
  }

  if (replaceExisting) {
    await prisma.doodadBrush.deleteMany({});
  }

  await prisma.doodadBrush.createMany({
    data: brushes.map((brush) => ({
      name: brush.name,
      type: brush.type,
      serverLookId: brush.serverLookId,
      draggable: brush.draggable,
      onBlocking: brush.onBlocking,
      thickness: brush.thickness,
      onDuplicate: brush.onDuplicate,
      oneSize: brush.oneSize,
      redoBorders: brush.redoBorders,
      reborder: brush.reborder,
      content: doodadFormToContent(brush),
    })),
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "import",
    entity: "doodad_brush",
    metadata: { imported: brushes.length, skipped: errors.length, replaceExisting },
  });

  return NextResponse.json({
    imported: brushes.length,
    skipped: errors.length,
    errors: errors.slice(0, 50),
  });
});
