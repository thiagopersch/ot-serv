import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { parseGroundsXml } from "@/lib/ground-xml-parser";
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
  const { grounds, errors } = parseGroundsXml(xml);

  if (grounds.length === 0) {
    return NextResponse.json(
      { error: "Nenhum ground válido encontrado no arquivo.", details: errors },
      { status: 422 }
    );
  }

  if (replaceExisting) {
    await prisma.ground.deleteMany({});
  }

  await prisma.ground.createMany({
    data: grounds.map((ground) => ({
      name: ground.name,
      serverLookId: ground.serverLookId,
      zOrder: ground.zOrder,
      soloOptional: ground.soloOptional,
      items: ground.items,
      borders: ground.borders,
      friends: ground.friends,
    })),
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "import",
    entity: "ground",
    metadata: { imported: grounds.length, skipped: errors.length, replaceExisting },
  });

  return NextResponse.json({
    imported: grounds.length,
    skipped: errors.length,
    errors: errors.slice(0, 50),
  });
});
