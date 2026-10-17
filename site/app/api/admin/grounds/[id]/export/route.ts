import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { groundToFormInput } from "@/lib/ground-mapper";
import { groundToXml } from "@/lib/ground-xml";
import { NextResponse } from "next/server";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const GET = withAudit(async function GET(_request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const ground = await prisma.ground.findUnique({ where: { id: Number(id) } });

  if (!ground) {
    return NextResponse.json({ error: "Ground não encontrado." }, { status: 404 });
  }

  const xml = groundToXml(groundToFormInput(ground)) + "\n";

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="ground-${ground.id}.xml"`,
    },
  });
});
