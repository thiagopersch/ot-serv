import { strToU8, zipSync, type Zippable } from "fflate";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { extOutfitsToXmlDocument } from "@/lib/extoutfit-xml";
import { extOutfitInclude, extOutfitToRow } from "@/lib/extoutfit-mapper";
import { extOutfitFileRefs, readExtOutfitFile } from "@/lib/extoutfit-files-server";
import { parseSelectedIds } from "@/lib/outfit-mapper";
import { withAudit } from "@/lib/api-audit-wrapper";

/** Pacote `.zip` na estrutura do servidor/cliente: `server/data/XML/extoutfits.xml` + arquivos de
 * cada registro (`cliente/data/shaders/*.frag`, `cliente/data/images/bars/*.png`, ...).
 * `?ids=1,2` (ids do portal) restringe aos selecionados; vazio = todos. */
export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const ids = parseSelectedIds(new URL(request.url));
  const entries = await prisma.extOutfit.findMany({
    where: ids ? { id: { in: ids } } : {},
    include: extOutfitInclude,
    orderBy: [{ kind: "asc" }, { xmlId: "asc" }],
  });
  const images = await prisma.entityImage.findMany({
    where: { entityType: "extoutfit", entityId: { in: entries.map((entry) => entry.id) } },
    select: { entityId: true, extension: true },
  });
  const extensionById = new Map(images.map((image) => [image.entityId, image.extension]));

  const zip: Zippable = {
    "server/data/XML/extoutfits.xml": strToU8(extOutfitsToXmlDocument(entries.map((entry) => extOutfitToRow(entry)))),
  };
  const missing: string[] = [];

  for (const entry of entries) {
    const extension = extensionById.get(entry.id) ?? null;
    const refs = extOutfitFileRefs(entry, extension);
    if (entry.kind === "shaders" && !refs.some((ref) => ref.part === "fragment")) {
      missing.push(`shaders #${entry.xmlId} ${entry.name}: sem .frag enviado`);
    }
    if ((entry.kind === "healthbars" || entry.kind === "manabars") && !refs.some((ref) => ref.part === "image")) {
      missing.push(`${entry.kind} #${entry.xmlId} ${entry.name}: sem imagem enviada (${entry.image ?? "-"})`);
    }
    for (const ref of refs) {
      const content = await readExtOutfitFile(entry, ref, extension);
      if (content) zip[ref.clientPath] = [content, { level: 0 }];
      else missing.push(`${entry.kind} #${entry.xmlId} ${entry.name}: ${ref.fileName} não encontrado no disco`);
    }
  }

  zip["LEIA-ME.txt"] = strToU8(
    [
      "Pacote gerado por /admin/extoutfits.",
      "server/  -> copiar para a pasta do servidor; cliente/ -> pasta do cliente.",
      "previews/ -> imagens só de preview do portal (wings/auras), não são assets do cliente.",
      "",
      `Registros: ${entries.length}`,
      ...(missing.length ? ["", "Arquivos ausentes:", ...missing] : []),
      "",
    ].join("\r\n"),
  );

  return new Response(Buffer.from(zipSync(zip)), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="extoutfits_bundle.zip"',
    },
  });
});
