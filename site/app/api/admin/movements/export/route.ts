import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { movementRowToFormInput } from "@/lib/movement-mapper";
import { movementsToXmlDocument } from "@/lib/movement-xml";
import { withAudit } from "@/lib/api-audit-wrapper";

export const GET = withAudit(async function GET() {
  const { response } = await requireAdminSession();
  if (response) return response;

  const movements = await prisma.movement.findMany({
    include: { vocations: { select: { vocationId: true } } },
    orderBy: { id: "asc" },
  });
  const xml = movementsToXmlDocument(movements.map(movementRowToFormInput));

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": 'attachment; filename="movements.xml"',
    },
  });
});
