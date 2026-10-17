import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { parseTilesetsXml } from "@/lib/tileset-xml-parser";
import {
  categoryTypeForKind,
  DOODAD_KINDS,
  TERRAIN_KINDS,
  type TilesetCategoryKind,
  type TilesetCategoryType,
  type TilesetXmlDocument,
} from "@/lib/validations/admin/tileset";
import { withAudit } from "@/lib/api-audit-wrapper";

/** Recria as categorias de um tileset já existente: desvincula os brushes (Ground/
 * WallBrush/DoodadBrush) das categorias antigas antes de apagá-las, para não colidir
 * com a restrição de FK que bloqueia excluir uma categoria ainda referenciada. */
async function clearExistingCategories(tilesetId: number): Promise<void> {
  const categories = await prisma.tilesetCategory.findMany({ where: { tilesetId }, select: { id: true } });
  const categoryIds = categories.map((c) => c.id);
  if (categoryIds.length === 0) return;

  await Promise.all([
    prisma.ground.updateMany({ where: { tilesetCategoryId: { in: categoryIds } }, data: { tilesetCategoryId: null } }),
    prisma.wallBrush.updateMany({ where: { tilesetCategoryId: { in: categoryIds } }, data: { tilesetCategoryId: null } }),
    prisma.doodadBrush.updateMany({ where: { tilesetCategoryId: { in: categoryIds } }, data: { tilesetCategoryId: null } }),
  ]);
  await prisma.tilesetCategory.deleteMany({ where: { tilesetId } });
}

type BrushMaps = { ground: Map<string, number>; wall: Map<string, number>; doodad: Map<string, number> };

/** Carrega todos os nomes de Ground/WallBrush/DoodadBrush em memória UMA vez para o
 * import inteiro — resolver cada `<brush name>` com uma query por entrada não escala
 * (um `tilesets.xml` real tem ~2000+ brushes), então isso troca N queries seriais por
 * 3 queries + lookups em memória (O(1) por entrada). */
async function loadBrushMaps(): Promise<BrushMaps> {
  const [grounds, walls, doodads] = await Promise.all([
    prisma.ground.findMany({ select: { id: true, name: true } }),
    prisma.wallBrush.findMany({ select: { id: true, name: true } }),
    prisma.doodadBrush.findMany({ select: { id: true, name: true } }),
  ]);

  return {
    ground: new Map(grounds.map((g) => [g.name, g.id])),
    wall: new Map(walls.map((w) => [w.name, w.id])),
    doodad: new Map(doodads.map((d) => [d.name, d.id])),
  };
}

/** Nomes de brush são um namespace global único no RME — um `terrain`/`terrain_and_raw`
 * pode referenciar um brush registrado como `type="carpet"` em `doodads.xml` (ex.: a
 * tileset "City Carpets" do arquivo de referência faz isso). Por isso a resolução
 * tenta primeiro a tabela "natural" do `kind` (Ground/Wall para terrain, Doodad para
 * doodad) e cai para as outras duas como fallback, em vez de restringir por kind. */
function resolveBrushFast(
  maps: BrushMaps,
  name: string,
  type: TilesetCategoryType,
  kind: TilesetCategoryKind
): { kind: "ground" | "wall" | "doodad"; id: number } | null {
  if (type !== "BRUSH") return null;

  const primary: ("ground" | "wall" | "doodad")[] = TERRAIN_KINDS.includes(kind)
    ? ["ground", "wall", "doodad"]
    : DOODAD_KINDS.includes(kind)
      ? ["doodad", "ground", "wall"]
      : ["ground", "wall", "doodad"];

  for (const brushKind of primary) {
    const id = maps[brushKind].get(name);
    if (id != null) return { kind: brushKind, id };
  }

  return null;
}

async function importTileset(doc: TilesetXmlDocument, tilesetId: number, maps: BrushMaps): Promise<{ unresolved: string[] }> {
  const unresolved: string[] = [];

  for (const [categoryIndex, category] of doc.categories.entries()) {
    const type = categoryTypeForKind(category.kind);
    const name = category.name || `${doc.name} - ${category.kind.toLowerCase()} #${categoryIndex + 1}`;

    const created = await prisma.tilesetCategory.create({
      data: { tilesetId, name, kind: category.kind, type, order: categoryIndex },
    });

    const groundIds: number[] = [];
    const wallIds: number[] = [];
    const doodadIds: number[] = [];
    const unresolvedNames: string[] = [];
    const itemEntries: { order: number; kind: "ITEM_ID" | "ITEM_RANGE"; itemId: number | null; fromId: number | null; toId: number | null }[] = [];
    let itemOrder = 0;

    // Puro em memória — nenhuma query aqui dentro, só classificação.
    for (const entry of category.entries) {
      if (entry.type === "brush") {
        const resolved = resolveBrushFast(maps, entry.name, type, category.kind);
        if (!resolved) {
          unresolvedNames.push(entry.name);
          unresolved.push(entry.name);
          continue;
        }
        if (resolved.kind === "ground") groundIds.push(resolved.id);
        else if (resolved.kind === "wall") wallIds.push(resolved.id);
        else doodadIds.push(resolved.id);
      } else if (entry.type === "item") {
        itemEntries.push({ order: itemOrder++, kind: "ITEM_ID", itemId: entry.itemId, fromId: null, toId: null });
      } else {
        itemEntries.push({ order: itemOrder++, kind: "ITEM_RANGE", itemId: null, fromId: entry.fromId, toId: entry.toId });
      }
    }

    // Batch: no máximo 5 operações paralelas por categoria (independente de quantos
    // brushes/itens ela tiver), em vez de uma query por entrada.
    await Promise.all([
      groundIds.length > 0
        ? prisma.ground.updateMany({ where: { id: { in: groundIds } }, data: { tilesetCategoryId: created.id } })
        : null,
      wallIds.length > 0
        ? prisma.wallBrush.updateMany({ where: { id: { in: wallIds } }, data: { tilesetCategoryId: created.id } })
        : null,
      doodadIds.length > 0
        ? prisma.doodadBrush.updateMany({ where: { id: { in: doodadIds } }, data: { tilesetCategoryId: created.id } })
        : null,
      itemEntries.length > 0
        ? prisma.tilesetItemEntry.createMany({ data: itemEntries.map((e) => ({ categoryId: created.id, ...e })) })
        : null,
      unresolvedNames.length > 0
        ? prisma.tilesetCategory.update({ where: { id: created.id }, data: { unresolvedBrushNames: unresolvedNames } })
        : null,
    ]);
  }

  return { unresolved };
}

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const formData = await request.formData();
  const file = formData.get("file");
  const format = formData.get("format") === "json" ? "json" : "xml";
  const replaceExisting = formData.get("replaceExisting") === "true";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 422 });
  }

  const raw = await file.text();
  let documents: TilesetXmlDocument[];
  let parseErrors: string[] = [];

  if (format === "json") {
    try {
      const parsed = JSON.parse(raw);
      documents = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return NextResponse.json({ error: "JSON inválido." }, { status: 422 });
    }
  } else {
    const result = parseTilesetsXml(raw);
    documents = result.tilesets;
    parseErrors = result.errors;
  }

  if (documents.length === 0) {
    return NextResponse.json({ error: "Nenhum tileset válido encontrado no arquivo.", details: parseErrors }, { status: 422 });
  }

  const maps = await loadBrushMaps();

  let imported = 0;
  let skipped = 0;
  const unresolvedBrushNames: string[] = [];

  for (const [index, doc] of documents.entries()) {
    const existing = await prisma.tileset.findUnique({ where: { name: doc.name }, select: { id: true } });

    if (existing && !replaceExisting) {
      skipped++;
      continue;
    }

    const tileset = existing
      ? existing
      : await prisma.tileset.create({ data: { name: doc.name, order: index } });

    if (existing && replaceExisting) {
      await clearExistingCategories(tileset.id);
    }

    const { unresolved } = await importTileset(doc, tileset.id, maps);
    unresolvedBrushNames.push(...unresolved);
    imported++;
  }

  await logAudit({
    accountId: Number(session.user.id),
    action: "import",
    entity: "tileset",
    metadata: { imported, skipped, unresolved: unresolvedBrushNames.length, replaceExisting, format },
  });

  return NextResponse.json({
    imported,
    skipped,
    unresolvedBrushNames: unresolvedBrushNames.slice(0, 100),
    errors: parseErrors.slice(0, 50),
  });
});
