import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { wallBrushToFormInput } from "@/lib/wall-mapper";
import { wallBrushToXml } from "@/lib/wall-xml";
import { NextResponse } from "next/server";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const GET = withAudit(async function GET(_request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const brush = await prisma.wallBrush.findUnique({ where: { id: Number(id) } });

  if (!brush) {
    return NextResponse.json({ error: "Wall não encontrada." }, { status: 404 });
  }

  const xml = wallBrushToXml(wallBrushToFormInput(brush)) + "\n";

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="wall-${brush.id}.xml"`,
    },
  });
});
