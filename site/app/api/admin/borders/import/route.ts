import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { parseBordersXml } from "@/lib/border-xml-parser";
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
  const { borders, errors } = parseBordersXml(xml);

  if (borders.length === 0) {
    return NextResponse.json(
      { error: "Nenhum border válido encontrado no arquivo.", details: errors },
      { status: 422 }
    );
  }

  if (replaceExisting) {
    await prisma.border.deleteMany({});
  }

  const result = await prisma.border.createMany({
    data: borders.map((border) => ({
      id: border.id,
      name: border.name,
      group: border.group,
      optional: border.optional,
      edges: border.edges,
    })),
    skipDuplicates: true,
  });

  const skippedDuplicates = borders.length - result.count;

  await logAudit({
    accountId: Number(session.user.id),
    action: "import",
    entity: "border",
    metadata: {
      imported: result.count,
      skipped: errors.length + skippedDuplicates,
      replaceExisting,
    },
  });

  return NextResponse.json({
    imported: result.count,
    skipped: errors.length + skippedDuplicates,
    errors: errors.slice(0, 50),
  });
});
