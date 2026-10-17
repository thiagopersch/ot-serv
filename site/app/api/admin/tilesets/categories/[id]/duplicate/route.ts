import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { tilesetCategoryToFormInput } from "@/lib/tileset-mapper";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const POST = withAudit(async function POST(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const source = await prisma.tilesetCategory.findUnique({ where: { id: Number(id) } });

  if (!source) {
    return NextResponse.json({ error: "Categoria não encontrada." }, { status: 404 });
  }

  const maxOrder = await prisma.tilesetCategory.aggregate({
    where: { tilesetId: source.tilesetId },
    _max: { order: true },
  });

  const category = await prisma.tilesetCategory.create({
    data: {
      tilesetId: source.tilesetId,
      name: `${source.name} (cópia)`,
      kind: source.kind,
      type: source.type,
      order: (maxOrder._max.order ?? 0) + 1,
      description: source.description,
    },
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "duplicate",
    entity: "tileset_category",
    entityId: category.id,
    metadata: { sourceId: source.id, name: category.name },
  });

  return NextResponse.json({ category: tilesetCategoryToFormInput(category) }, { status: 201 });
});
