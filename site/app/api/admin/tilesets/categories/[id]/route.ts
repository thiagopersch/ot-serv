import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { categoryTypeForKind, TERRAIN_KINDS, tilesetCategoryFormSchema } from "@/lib/validations/admin/tileset";
import { tilesetCategoryToFormInput } from "@/lib/tileset-mapper";
import { assertCategoryDeletable, reassignCategoryEntries, TilesetIntegrityError } from "@/lib/tileset-integrity";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const GET = withAudit(async function GET(_request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const category = await prisma.tilesetCategory.findUnique({
    where: { id: Number(id) },
    include: {
      _count: { select: { grounds: true, walls: true, doodads: true, itemEntries: true } },
      grounds: { select: { id: true, name: true, tilesetOrder: true }, orderBy: { tilesetOrder: "asc" } },
      walls: { select: { id: true, name: true, tilesetOrder: true }, orderBy: { tilesetOrder: "asc" } },
      doodads: { select: { id: true, name: true, tilesetOrder: true }, orderBy: { tilesetOrder: "asc" } },
    },
  });

  if (!category) {
    return NextResponse.json({ error: "Categoria não encontrada." }, { status: 404 });
  }

  return NextResponse.json({
    category: {
      ...tilesetCategoryToFormInput(category),
      _count: category._count,
      grounds: category.grounds,
      walls: category.walls,
      doodads: category.doodads,
    },
  });
});

export const PATCH = withAudit(async function PATCH(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const categoryId = Number(id);
  const body = await request.json();

  const existing = await prisma.tilesetCategory.findUnique({
    where: { id: categoryId },
    include: { _count: { select: { grounds: true, walls: true, doodads: true, itemEntries: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Categoria não encontrada." }, { status: 404 });
  }

  const parsed = tilesetCategoryFormSchema.safeParse({ tilesetId: existing.tilesetId, ...body });
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const kindChangedType = categoryTypeForKind(parsed.data.kind) !== existing.type;
  const linkedCount = existing._count.grounds + existing._count.walls + existing._count.doodads + existing._count.itemEntries;
  if (kindChangedType && linkedCount > 0) {
    return NextResponse.json(
      { error: `Não é possível mudar o tipo da categoria: há ${linkedCount} brush(es)/item(ns) vinculado(s).` },
      { status: 409 }
    );
  }

  const brushKindChanged =
    categoryTypeForKind(parsed.data.kind) === "BRUSH" &&
    (existing._count.grounds > 0 || existing._count.walls > 0) &&
    !TERRAIN_KINDS.includes(parsed.data.kind);
  if (brushKindChanged) {
    return NextResponse.json(
      { error: "Não é possível mudar para um kind de doodad: há Ground/Wall vinculados a esta categoria." },
      { status: 409 }
    );
  }

  if (parsed.data.tilesetId !== existing.tilesetId) {
    const targetTileset = await prisma.tileset.findUnique({ where: { id: parsed.data.tilesetId }, select: { id: true } });
    if (!targetTileset) {
      return NextResponse.json({ error: "Tileset de destino não encontrado." }, { status: 404 });
    }
  }

  const category = await prisma.tilesetCategory.update({
    where: { id: categoryId },
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
    action: "update",
    entity: "tileset_category",
    entityId: category.id,
    metadata: { tilesetId: category.tilesetId, name: category.name },
  });

  return NextResponse.json({ category: tilesetCategoryToFormInput(category) });
});

export const DELETE = withAudit(async function DELETE(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const categoryId = Number(id);
  const url = new URL(request.url);
  const moveEntriesToParam = url.searchParams.get("moveEntriesTo");
  const moveEntriesTo = moveEntriesToParam != null ? Number(moveEntriesToParam) : undefined;

  try {
    await assertCategoryDeletable(categoryId, moveEntriesTo);

    if (moveEntriesTo != null) {
      await reassignCategoryEntries(categoryId, moveEntriesTo);
    }

    await prisma.tilesetCategory.delete({ where: { id: categoryId } });

    await logAudit({
      accountId: Number(session.user.id),
      action: "delete",
      entity: "tileset_category",
      entityId: categoryId,
      metadata: moveEntriesTo != null ? { movedEntriesTo: moveEntriesTo } : undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TilesetIntegrityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
});
