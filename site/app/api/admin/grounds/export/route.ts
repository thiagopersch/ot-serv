import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { groundToFormInput } from "@/lib/ground-mapper";
import { groundsToXmlDocument } from "@/lib/ground-xml";
import { withAudit } from "@/lib/api-audit-wrapper";

export const GET = withAudit(async function GET() {
  const { response } = await requireAdminSession();
  if (response) return response;

  const grounds = await prisma.ground.findMany({ orderBy: { id: "asc" } });
  const xml = groundsToXmlDocument(grounds.map(groundToFormInput));

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": 'attachment; filename="grounds.xml"',
    },
  });
});
