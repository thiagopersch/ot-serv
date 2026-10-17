import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { luaScriptSchema } from "@/lib/validations/admin/lua-script";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const GET = withAudit(async function GET(_request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const luaScript = await prisma.luaScript.findUnique({
    where: { id: Number(id) },
  });

  if (!luaScript || luaScript.deletedAt) {
    return NextResponse.json(
      { error: "Script não encontrado." },
      { status: 404 },
    );
  }

  return NextResponse.json({ luaScript });
});

export const PATCH = withAudit(async function PATCH(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const body = await request.json();
  const parsed = luaScriptSchema.partial().safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 422 },
    );
  }

  if (parsed.data.name || parsed.data.category) {
    const current = await prisma.luaScript.findUnique({
      where: { id: Number(id) },
    });
    if (!current) {
      return NextResponse.json(
        { error: "Script não encontrado." },
        { status: 404 },
      );
    }

    const effectiveName = parsed.data.name ?? current.name;
    const effectiveCategory = parsed.data.category ?? current.category;

    const duplicate = await prisma.luaScript.findFirst({
      where: {
        name: effectiveName,
        category: effectiveCategory,
        NOT: { id: Number(id) },
      },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "Já existe um script com esse nome nessa categoria." },
        { status: 409 },
      );
    }
  }

  const luaScript = await prisma.luaScript.update({
    where: { id: Number(id) },
    data: parsed.data,
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "lua_script",
    entityId: luaScript.id,
    metadata: { name: luaScript.name, category: luaScript.category },
  });

  return NextResponse.json({ luaScript });
});

export const DELETE = withAudit(async function DELETE(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;

  // Soft delete — zera os vínculos que antes o `onDelete: SetNull` das relations cuidava
  // sozinho (não dispara em soft delete, precisa ser feito explicitamente).
  await prisma.$transaction([
    prisma.movement.updateMany({ where: { luaScriptId: Number(id) }, data: { luaScriptId: null } }),
    prisma.npc.updateMany({ where: { scriptId: Number(id) }, data: { scriptId: null } }),
    prisma.luaScript.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } }),
  ]);

  await logAudit({
    accountId: Number(session.user.id),
    action: "delete",
    entity: "lua_script",
    entityId: id,
  });

  return NextResponse.json({ success: true });
});
