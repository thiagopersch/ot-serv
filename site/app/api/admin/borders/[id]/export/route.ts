import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { borderToFormInput } from "@/lib/border-mapper";
import { borderToXml } from "@/lib/border-xml";
import { NextResponse } from "next/server";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const GET = withAudit(async function GET(_request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const border = await prisma.border.findUnique({ where: { id: Number(id) } });

  if (!border) {
    return NextResponse.json({ error: "Border não encontrado." }, { status: 404 });
  }

  const xml = borderToXml(borderToFormInput(border)) + "\n";

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="border-${border.id}.xml"`,
    },
  });
});
