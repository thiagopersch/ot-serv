import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { assertCategoryForBrush, TilesetIntegrityError } from "@/lib/tileset-integrity";
import { withAudit } from "@/lib/api-audit-wrapper";

const assignSchema = z.object({
  brushKind: z.enum(["ground", "wall", "doodad"]),
  ids: z.array(z.number().int()).min(1),
  categoryId: z.number().int(),
});

function updateBrush(brushKind: "ground" | "wall" | "doodad", id: number, data: { tilesetCategoryId: number; tilesetOrder: number }) {
  switch (brushKind) {
    case "ground":
      return prisma.ground.updateMany({ where: { id }, data });
    case "wall":
      return prisma.wallBrush.updateMany({ where: { id }, data });
    case "doodad":
      return prisma.doodadBrush.updateMany({ where: { id }, data });
  }
}

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const body = await request.json();
  const parsed = assignSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const { brushKind, ids, categoryId } = parsed.data;

  try {
    await assertCategoryForBrush(categoryId, brushKind === "doodad" ? "doodad" : "terrain");

    const existingMax = await prisma.tilesetCategory.findUnique({
      where: { id: categoryId },
      select: {
        _count: { select: { grounds: true, walls: true, doodads: true } },
      },
    });
    const baseOrder = existingMax
      ? existingMax._count.grounds + existingMax._count.walls + existingMax._count.doodads
      : 0;

    await prisma.$transaction(
      ids.map((id, index) => updateBrush(brushKind, id, { tilesetCategoryId: categoryId, tilesetOrder: baseOrder + index }))
    );

    await logAudit({
      accountId: Number(session.user.id),
      action: "bulk_assign_category",
      entity: `${brushKind}_brush`,
      metadata: { categoryId, count: ids.length },
    });

    return NextResponse.json({ success: true, count: ids.length });
  } catch (error) {
    if (error instanceof TilesetIntegrityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
});
