import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { vocationsToXmlDocument } from "@/lib/vocation-xml";
import { vocationToInput } from "@/lib/vocation-mapper";
import { withAudit } from "@/lib/api-audit-wrapper";

export const GET = withAudit(async function GET() {
  const { response } = await requireAdminSession();
  if (response) return response;

  const vocations = await prisma.vocation.findMany({
    orderBy: { id: "asc" },
    include: { archetype: true, typeUniverse: true },
  });

  const xml = vocationsToXmlDocument(
    vocations.map((vocation) => ({
      ...vocationToInput(vocation),
      archetypeName: vocation.archetype?.name ?? null,
      typeUniverseName: vocation.typeUniverse?.name ?? "",
    }))
  );

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": 'attachment; filename="vocations.xml"',
    },
  });
});
