import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { itemRowToFormInput } from "@/lib/item-mapper";
import { itemToXml } from "@/lib/item-xml";
import { NextResponse } from "next/server";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const GET = withAudit(async function GET(_request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const item = await prisma.item.findUnique({ where: { id: Number(id) } });

  if (!item) {
    return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
  }

  const xml = itemToXml(itemRowToFormInput(item)) + "\n";

  return new Response(Buffer.from(xml, "latin1"), {
    headers: {
      "Content-Type": "application/xml; charset=iso-8859-1",
      "Content-Disposition": `attachment; filename="${item.id}.xml"`,
    },
  });
});
