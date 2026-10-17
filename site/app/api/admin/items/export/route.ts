import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { itemRowToFormInput } from "@/lib/item-mapper";
import { itemsToXmlDocument } from "@/lib/item-xml";
import { withAudit } from "@/lib/api-audit-wrapper";

export const GET = withAudit(async function GET() {
  const { response } = await requireAdminSession();
  if (response) return response;

  const items = await prisma.item.findMany({ orderBy: { id: "asc" } });
  const xml = itemsToXmlDocument(items.map(itemRowToFormInput));

  return new Response(Buffer.from(xml, "latin1"), {
    headers: {
      "Content-Type": "application/xml; charset=iso-8859-1",
      "Content-Disposition": 'attachment; filename="items.xml"',
    },
  });
});
