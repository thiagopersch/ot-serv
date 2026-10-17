import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { doodadBrushToFormInput } from "@/lib/doodad-mapper";
import { doodadToXml } from "@/lib/doodad-xml";
import { NextResponse } from "next/server";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const GET = withAudit(async function GET(_request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const brush = await prisma.doodadBrush.findUnique({ where: { id: Number(id) } });

  if (!brush) {
    return NextResponse.json({ error: "Doodad não encontrado." }, { status: 404 });
  }

  const xml = doodadToXml(doodadBrushToFormInput(brush)) + "\n";

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="doodad-${brush.id}.xml"`,
    },
  });
});
