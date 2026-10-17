import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { tilesetCategoryFormSchema } from "@/lib/validations/admin/tileset";
import { tilesetCategoryToFormInput } from "@/lib/tileset-mapper";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const GET = withAudit(async function GET(_request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const categories = await prisma.tilesetCategory.findMany({
    where: { tilesetId: Number(id) },
    orderBy: { order: "asc" },
    include: {
      _count: { select: { grounds: true, walls: true, doodads: true, itemEntries: true } },
    },
  });

  return NextResponse.json({
    categories: categories.map((category) => ({ ...tilesetCategoryToFormInput(category), _count: category._count })),
  });
});

export const POST = withAudit(async function POST(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const body = await request.json();
  const parsed = tilesetCategoryFormSchema.safeParse({ ...body, tilesetId: Number(id) });

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const tileset = await prisma.tileset.findUnique({ where: { id: parsed.data.tilesetId }, select: { id: true } });
  if (!tileset) {
    return NextResponse.json({ error: "Tileset não encontrado." }, { status: 404 });
  }

  const category = await prisma.tilesetCategory.create({
    data: {
      tilesetId: parsed.data.tilesetId,
      name: parsed.data.name,
      kind: parsed.data.kind,
      type: parsed.data.type,
      order: parsed.data.order,
      description: parsed.data.description,
    },
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "create",
    entity: "tileset_category",
    entityId: category.id,
    metadata: { tilesetId: category.tilesetId, name: category.name, kind: category.kind },
  });

  return NextResponse.json({ category: tilesetCategoryToFormInput(category) }, { status: 201 });
});
