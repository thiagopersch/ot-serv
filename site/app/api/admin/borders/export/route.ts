import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { borderToFormInput } from "@/lib/border-mapper";
import { bordersToXmlDocument } from "@/lib/border-xml";
import { withAudit } from "@/lib/api-audit-wrapper";

export const GET = withAudit(async function GET() {
  const { response } = await requireAdminSession();
  if (response) return response;

  const borders = await prisma.border.findMany({ orderBy: { id: "asc" } });
  const xml = bordersToXmlDocument(borders.map(borderToFormInput));

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": 'attachment; filename="borders.xml"',
    },
  });
});
