import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { withAudit } from "@/lib/api-audit-wrapper";

export const GET = withAudit(async function GET() {
  const { response } = await requireAdminSession();
  if (response) return response;

  const [
    tilesetsTotal,
    categoriesTotal,
    uncategorizedGrounds,
    uncategorizedWalls,
    uncategorizedDoodads,
    categoriesWithUnresolved,
    emptyBrushCategories,
    emptyItemCategories,
  ] = await Promise.all([
    prisma.tileset.count(),
    prisma.tilesetCategory.count(),
    prisma.ground.count({ where: { tilesetCategoryId: null } }),
    prisma.wallBrush.count({ where: { tilesetCategoryId: null } }),
    prisma.doodadBrush.count({ where: { tilesetCategoryId: null } }),
    prisma.tilesetCategory.findMany({
      where: { NOT: { unresolvedBrushNames: { equals: [] } } },
      select: { id: true, name: true, tilesetId: true, unresolvedBrushNames: true },
    }),
    prisma.tilesetCategory.findMany({
      where: {
        type: "BRUSH",
        grounds: { none: {} },
        walls: { none: {} },
        doodads: { none: {} },
      },
      select: { id: true, name: true, tilesetId: true },
    }),
    prisma.tilesetCategory.findMany({
      where: { type: "ITEM", itemEntries: { none: {} } },
      select: { id: true, name: true, tilesetId: true },
    }),
  ]);

  const unresolvedTotal = categoriesWithUnresolved.reduce(
    (sum, c) => sum + (Array.isArray(c.unresolvedBrushNames) ? c.unresolvedBrushNames.length : 0),
    0
  );

  return NextResponse.json({
    tilesetsTotal,
    categoriesTotal,
    uncategorizedBrushes: {
      grounds: uncategorizedGrounds,
      walls: uncategorizedWalls,
      doodads: uncategorizedDoodads,
      total: uncategorizedGrounds + uncategorizedWalls + uncategorizedDoodads,
    },
    unresolvedBrushNames: {
      total: unresolvedTotal,
      categories: categoriesWithUnresolved,
    },
    emptyCategories: {
      brush: emptyBrushCategories,
      item: emptyItemCategories,
      total: emptyBrushCategories.length + emptyItemCategories.length,
    },
    isHealthy:
      uncategorizedGrounds + uncategorizedWalls + uncategorizedDoodads === 0 && unresolvedTotal === 0,
  });
});
