import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { parseItemsXml } from "@/lib/item-xml-parser";
import { importItemsBatched } from "@/lib/item-mapper";
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
  const { items, errors } = parseItemsXml(xml);

  if (items.length === 0) {
    return NextResponse.json(
      { error: "Nenhum item válido encontrado no arquivo.", details: errors },
      { status: 422 }
    );
  }

  await importItemsBatched(prisma, items, { replaceExisting });

  await logAudit({
    accountId: Number(session.user.id),
    action: "import",
    entity: "item",
    metadata: { imported: items.length, skipped: errors.length, replaceExisting },
  });

  return NextResponse.json({
    imported: items.length,
    skipped: errors.length,
    errors: errors.slice(0, 50),
  });
});
