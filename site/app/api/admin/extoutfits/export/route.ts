import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { extOutfitsToXmlDocument } from "@/lib/extoutfit-xml";
import { extOutfitInclude, extOutfitToRow } from "@/lib/extoutfit-mapper";
import { parseSelectedIds } from "@/lib/outfit-mapper";
import { withAudit } from "@/lib/api-audit-wrapper";

/** `?ids=1,2` (ids do portal) exporta só os selecionados (vazio = todos); `?inline=1` devolve sem
 * `Content-Disposition: attachment` (copiar/pré-visualizar). */
export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const url = new URL(request.url);
  const ids = parseSelectedIds(url);

  const entries = await prisma.extOutfit.findMany({
    where: ids ? { id: { in: ids } } : {},
    include: extOutfitInclude,
  });

  const xml = extOutfitsToXmlDocument(entries.map((entry) => extOutfitToRow(entry)));

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      ...(url.searchParams.get("inline") === "1"
        ? {}
        : { "Content-Disposition": 'attachment; filename="extoutfits.xml"' }),
    },
  });
});
