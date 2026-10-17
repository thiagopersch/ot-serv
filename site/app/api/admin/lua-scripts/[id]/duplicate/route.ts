import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { uniqueCopyName } from "@/lib/duplicate-utils";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const POST = withAudit(async function POST(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const source = await prisma.luaScript.findUnique({ where: { id: Number(id) } });

  if (!source || source.deletedAt) {
    return NextResponse.json({ error: "Script não encontrado." }, { status: 404 });
  }

  const name = await uniqueCopyName(
    source.name,
    async (candidate) =>
      (await prisma.luaScript.findUnique({
        where: { name_category: { name: candidate, category: source.category } },
        select: { id: true },
      })) != null,
  );

  const { id: _id, name: _name, createdAt, updatedAt, ...rest } = source;
  void _id;
  void _name;
  void createdAt;
  void updatedAt;

  const luaScript = await prisma.luaScript.create({
    data: { ...rest, name },
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "duplicate",
    entity: "lua_script",
    entityId: luaScript.id,
    metadata: { sourceId: source.id, name: luaScript.name },
  });

  return NextResponse.json({ id: luaScript.id, name: luaScript.name }, { status: 201 });
});
