import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { groundFormSchema } from "@/lib/validations/admin/ground";
import { groundToFormInput } from "@/lib/ground-mapper";
import { assertCategoryForBrush, TilesetIntegrityError } from "@/lib/tileset-integrity";
import { hasDuplicateName } from "@/lib/unique-name";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const GET = withAudit(async function GET(_request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const ground = await prisma.ground.findUnique({ where: { id: Number(id) } });

  if (!ground) {
    return NextResponse.json({ error: "Ground não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ground: groundToFormInput(ground) });
});

export const PATCH = withAudit(async function PATCH(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const body = await request.json();
  const parsed = groundFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  try {
    await assertCategoryForBrush(parsed.data.tilesetCategoryId, "terrain");

    const existingNames = await prisma.ground.findMany({ select: { id: true, name: true } });
    if (hasDuplicateName(existingNames, parsed.data.name, Number(id))) {
      return NextResponse.json({ error: "Já existe um ground com esse nome." }, { status: 409 });
    }

    const ground = await prisma.ground.update({
      where: { id: Number(id) },
      data: {
        name: parsed.data.name,
        serverLookId: parsed.data.serverLookId,
        zOrder: parsed.data.zOrder,
        soloOptional: parsed.data.soloOptional,
        items: parsed.data.items,
        borders: parsed.data.borders,
        friends: parsed.data.friends,
        tilesetCategoryId: parsed.data.tilesetCategoryId,
      },
    });

    await logAudit({
      accountId: Number(session.user.id),
      action: "update",
      entity: "ground",
      entityId: ground.id,
      metadata: { name: ground.name },
    });

    return NextResponse.json({ ground: groundToFormInput(ground) });
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
  await prisma.ground.delete({ where: { id: Number(id) } });

  await logAudit({
    accountId: Number(session.user.id),
    action: "delete",
    entity: "ground",
    entityId: id,
  });

  return NextResponse.json({ success: true });
});
