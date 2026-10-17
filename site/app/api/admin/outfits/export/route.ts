import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { outfitsToXmlDocument } from "@/lib/outfit-xml";
import { outfitInclude, outfitToRow, parseSelectedIds } from "@/lib/outfit-mapper";
import { withAudit } from "@/lib/api-audit-wrapper";

/** `?ids=1,2` exporta só os selecionados (vazio = todas); `?inline=1` devolve sem
 * `Content-Disposition: attachment` (copiar/pré-visualizar). */
export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const url = new URL(request.url);
  const ids = parseSelectedIds(url);

  const outfits = await prisma.outfitDefinition.findMany({
    where: ids ? { id: { in: ids } } : {},
    orderBy: { id: "asc" },
    include: outfitInclude,
  });

  const xml = outfitsToXmlDocument(outfits.map((outfit) => outfitToRow(outfit)));

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      ...(url.searchParams.get("inline") === "1"
        ? {}
        : { "Content-Disposition": 'attachment; filename="outfits.xml"' }),
    },
  });
});
