import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { wallFormSchema } from "@/lib/validations/admin/wall";
import { wallBrushToFormInput, wallFormToContent } from "@/lib/wall-mapper";
import { assertCategoryForBrush, TilesetIntegrityError } from "@/lib/tileset-integrity";
import { hasDuplicateName } from "@/lib/unique-name";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const GET = withAudit(async function GET(_request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const brush = await prisma.wallBrush.findUnique({ where: { id: Number(id) } });

  if (!brush) {
    return NextResponse.json({ error: "Wall não encontrada." }, { status: 404 });
  }

  return NextResponse.json({ brush: wallBrushToFormInput(brush) });
});

export const PATCH = withAudit(async function PATCH(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const body = await request.json();
  const parsed = wallFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  try {
    await assertCategoryForBrush(parsed.data.tilesetCategoryId, "terrain");

    const existingNames = await prisma.wallBrush.findMany({ select: { id: true, name: true } });
    if (hasDuplicateName(existingNames, parsed.data.name, Number(id))) {
      return NextResponse.json({ error: "Já existe uma wall com esse nome." }, { status: 409 });
    }

    const brush = await prisma.wallBrush.update({
      where: { id: Number(id) },
      data: {
        name: parsed.data.name,
        type: parsed.data.type,
        serverLookId: parsed.data.serverLookId,
        draggable: parsed.data.draggable,
        onBlocking: parsed.data.onBlocking,
        thickness: parsed.data.thickness,
        onDuplicate: parsed.data.onDuplicate,
        oneSize: parsed.data.oneSize,
        redoBorders: parsed.data.redoBorders,
        reborder: parsed.data.reborder,
        content: wallFormToContent(parsed.data),
        friends: parsed.data.friends,
        tilesetCategoryId: parsed.data.tilesetCategoryId,
      },
    });

    await logAudit({
      accountId: Number(session.user.id),
      action: "update",
      entity: "wall_brush",
      entityId: brush.id,
      metadata: { name: brush.name, type: brush.type },
    });

    return NextResponse.json({ brush: wallBrushToFormInput(brush) });
  } catch (error) {
    if (error instanceof TilesetIntegrityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
});

export const DELETE = withAudit(async function DELETE(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  await prisma.wallBrush.delete({ where: { id: Number(id) } });

  await logAudit({
    accountId: Number(session.user.id),
    action: "delete",
    entity: "wall_brush",
    entityId: id,
  });

  return NextResponse.json({ success: true });
});
