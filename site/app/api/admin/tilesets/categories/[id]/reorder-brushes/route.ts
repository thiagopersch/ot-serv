import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

const reorderSchema = z.object({
  items: z
    .array(
      z.object({
        type: z.enum(["ground", "wall", "doodad"]),
        id: z.number().int(),
        order: z.number().int(),
      })
    )
    .min(1),
});

const TABLE_BY_TYPE = {
  ground: "grounds",
  wall: "wall_brushes",
  doodad: "doodad_brushes",
} as const;

/** Atualiza `tileset_order` de vários registros de uma tabela com um único
 * `UPDATE ... SET tileset_order = CASE id WHEN ... END WHERE id IN (...)` — uma
 * categoria grande pode ter centenas de brushes, e um `.update()` por registro
 * dentro de uma transação interativa estourava o timeout padrão do Prisma (5s). */
function buildBulkUpdateOrder(table: string, items: { id: number; order: number }[]) {
  const cases = Prisma.join(
    items.map((item) => Prisma.sql`WHEN ${item.id} THEN ${item.order}`),
    " "
  );
  const ids = Prisma.join(items.map((item) => item.id));

  return prisma.$executeRaw`UPDATE ${Prisma.raw(table)} SET tileset_order = CASE id ${cases} END WHERE id IN (${ids})`;
}

export const PATCH = withAudit(async function PATCH(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const categoryId = Number(id);
  const body = await request.json();
  const parsed = reorderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const category = await prisma.tilesetCategory.findUnique({
    where: { id: categoryId },
    include: {
      grounds: { select: { id: true } },
      walls: { select: { id: true } },
      doodads: { select: { id: true } },
    },
  });
  if (!category) {
    return NextResponse.json({ error: "Categoria não encontrada." }, { status: 404 });
  }

  const idsByType: Record<"ground" | "wall" | "doodad", Set<number>> = {
    ground: new Set(category.grounds.map((g) => g.id)),
    wall: new Set(category.walls.map((w) => w.id)),
    doodad: new Set(category.doodads.map((d) => d.id)),
  };

  const invalid = parsed.data.items.some((item) => !idsByType[item.type].has(item.id));
  if (invalid) {
    return NextResponse.json(
      { error: "Um ou mais brushes não pertencem a esta categoria." },
      { status: 409 }
    );
  }

  const itemsByType = {
    ground: parsed.data.items.filter((item) => item.type === "ground"),
    wall: parsed.data.items.filter((item) => item.type === "wall"),
    doodad: parsed.data.items.filter((item) => item.type === "doodad"),
  };

  const statements = (Object.keys(itemsByType) as (keyof typeof itemsByType)[])
    .filter((type) => itemsByType[type].length > 0)
    .map((type) => buildBulkUpdateOrder(TABLE_BY_TYPE[type], itemsByType[type]));

  await prisma.$transaction(statements);

  await logAudit({
    accountId: Number(session.user.id),
    action: "reorder",
    entity: "tileset_category_brushes",
    entityId: categoryId,
    metadata: { count: parsed.data.items.length },
  });

  return NextResponse.json({ success: true });
});
