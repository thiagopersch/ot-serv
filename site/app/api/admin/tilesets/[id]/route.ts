import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { tilesetFormSchema } from "@/lib/validations/admin/tileset";
import { tilesetToFormInput } from "@/lib/tileset-mapper";
import {
  assertTilesetDeletable,
  assertUniqueTilesetName,
  reassignTilesetCategories,
  TilesetIntegrityError,
} from "@/lib/tileset-integrity";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const GET = withAudit(async function GET(_request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const tileset = await prisma.tileset.findUnique({
    where: { id: Number(id) },
    include: { _count: { select: { categories: true } } },
  });

  if (!tileset) {
    return NextResponse.json({ error: "Tileset não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ tileset: { ...tilesetToFormInput(tileset), _count: tileset._count } });
});

export const PATCH = withAudit(async function PATCH(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const tilesetId = Number(id);
  const body = await request.json();
  const parsed = tilesetFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  try {
    await assertUniqueTilesetName(parsed.data.name, tilesetId);

    const tileset = await prisma.tileset.update({
      where: { id: tilesetId },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        order: parsed.data.order,
        active: parsed.data.active,
        icon: parsed.data.icon,
        rawIdsInBrush: parsed.data.rawIdsInBrush,
      },
    });

    await logAudit({
      accountId: Number(session.user.id),
      action: "update",
      entity: "tileset",
      entityId: tileset.id,
      metadata: { name: tileset.name },
    });

    return NextResponse.json({ tileset: tilesetToFormInput(tileset) });
  } catch (error) {
    if (error instanceof TilesetIntegrityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
});

export const DELETE = withAudit(async function DELETE(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const tilesetId = Number(id);
  const url = new URL(request.url);
  const moveCategoriesToParam = url.searchParams.get("moveCategoriesTo");
  const moveCategoriesTo = moveCategoriesToParam != null ? Number(moveCategoriesToParam) : undefined;

  try {
    await assertTilesetDeletable(tilesetId, moveCategoriesTo);

    if (moveCategoriesTo != null) {
      await reassignTilesetCategories(tilesetId, moveCategoriesTo);
    }

    await prisma.tileset.delete({ where: { id: tilesetId } });

    await logAudit({
      accountId: Number(session.user.id),
      action: "delete",
      entity: "tileset",
      entityId: tilesetId,
      metadata: moveCategoriesTo != null ? { movedCategoriesTo: moveCategoriesTo } : undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TilesetIntegrityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
});
