import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { wallBrushToFormInput } from "@/lib/wall-mapper";
import { wallsToXmlDocument } from "@/lib/wall-xml";
import { withAudit } from "@/lib/api-audit-wrapper";

export const GET = withAudit(async function GET() {
  const { response } = await requireAdminSession();
  if (response) return response;

  const brushes = await prisma.wallBrush.findMany({ orderBy: { id: "asc" } });
  const xml = wallsToXmlDocument(brushes.map(wallBrushToFormInput));

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": 'attachment; filename="walls.xml"',
    },
  });
});
