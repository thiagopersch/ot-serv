import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { tilesetToXmlDocument, type TilesetCategoryWithEntries } from "@/lib/tileset-mapper";
import { tilesetsToXmlDocument } from "@/lib/tileset-xml";
import { withAudit } from "@/lib/api-audit-wrapper";

const CATEGORY_INCLUDE = {
  grounds: { select: { name: true, tilesetOrder: true, items: true } },
  walls: { select: { name: true, tilesetOrder: true, content: true } },
  doodads: { select: { name: true, tilesetOrder: true, content: true } },
  itemEntries: true,
} as const;

export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const url = new URL(request.url);
  const idsParam = url.searchParams.get("ids");
  const format = url.searchParams.get("format") === "json" ? "json" : "xml";
  const ids = idsParam
    ? idsParam
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value))
    : null;

  const tilesets = await prisma.tileset.findMany({
    where: ids ? { id: { in: ids } } : { active: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: {
      categories: {
        orderBy: { order: "asc" },
        include: CATEGORY_INCLUDE,
      },
    },
  });

  if (format === "json") {
    return new Response(JSON.stringify(tilesets, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="tilesets.json"',
      },
    });
  }

  const documents = tilesets.map((tileset) =>
    tilesetToXmlDocument({ ...tileset, categories: tileset.categories as TilesetCategoryWithEntries[] })
  );
  const xml = tilesetsToXmlDocument(documents);

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": 'attachment; filename="tilesets.xml"',
    },
  });
});
