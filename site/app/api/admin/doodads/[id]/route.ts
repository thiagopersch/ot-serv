import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { doodadFormSchema } from "@/lib/validations/admin/doodad";
import { doodadBrushToFormInput, doodadFormToContent } from "@/lib/doodad-mapper";
import { assertCategoryForBrush, TilesetIntegrityError } from "@/lib/tileset-integrity";
import { hasDuplicateName } from "@/lib/unique-name";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const GET = withAudit(async function GET(_request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const brush = await prisma.doodadBrush.findUnique({ where: { id: Number(id) } });

  if (!brush) {
    return NextResponse.json({ error: "Doodad não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ brush: doodadBrushToFormInput(brush) });
});

export const PATCH = withAudit(async function PATCH(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const body = await request.json();
  const parsed = doodadFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  try {
    await assertCategoryForBrush(parsed.data.tilesetCategoryId, "doodad");

    const existingNames = await prisma.doodadBrush.findMany({ select: { id: true, name: true } });
    if (hasDuplicateName(existingNames, parsed.data.name, Number(id))) {
      return NextResponse.json({ error: "Já existe um doodad com esse nome." }, { status: 409 });
    }

    const brush = await prisma.doodadBrush.update({
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
        content: doodadFormToContent(parsed.data),
        tilesetCategoryId: parsed.data.tilesetCategoryId,
      },
    });

    await logAudit({
      accountId: Number(session.user.id),
      action: "update",
      entity: "doodad_brush",
      entityId: brush.id,
      metadata: { name: brush.name, type: brush.type },
    });

    return NextResponse.json({ brush: doodadBrushToFormInput(brush) });
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
  await prisma.doodadBrush.delete({ where: { id: Number(id) } });

  await logAudit({
    accountId: Number(session.user.id),
    action: "delete",
    entity: "doodad_brush",
    entityId: id,
  });

  return NextResponse.json({ success: true });
});
