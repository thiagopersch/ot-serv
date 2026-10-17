import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { doodadBrushToFormInput } from "@/lib/doodad-mapper";
import { doodadsToXmlDocument } from "@/lib/doodad-xml";
import { withAudit } from "@/lib/api-audit-wrapper";

export const GET = withAudit(async function GET() {
  const { response } = await requireAdminSession();
  if (response) return response;

  const brushes = await prisma.doodadBrush.findMany({ orderBy: { id: "asc" } });
  const xml = doodadsToXmlDocument(brushes.map(doodadBrushToFormInput));

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": 'attachment; filename="doodads.xml"',
    },
  });
});
