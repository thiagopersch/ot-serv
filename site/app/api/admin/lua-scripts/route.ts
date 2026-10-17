import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { buildPaginatedResult, parseIdsParam, parsePaginationParams } from "@/lib/pagination";
import { luaScriptSchema } from "@/lib/validations/admin/lua-script";
import { withAudit } from "@/lib/api-audit-wrapper";

export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const url = new URL(request.url);

  const ids = parseIdsParam(url);
  if (ids) {
    const scriptsById = await prisma.luaScript.findMany({ where: { id: { in: ids }, deletedAt: null } });
    return NextResponse.json(buildPaginatedResult(scriptsById, scriptsById.length, 1, scriptsById.length || 1));
  }

  const { page, pageSize, search } = parsePaginationParams(url);
  const category = url.searchParams.get("category");

  const where: Prisma.LuaScriptWhereInput = {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            ...(Number.isInteger(Number(search)) ? [{ id: Number(search) }] : []),
          ],
        }
      : {}),
    ...(category ? { category } : {}),
  };

  const [scripts, total] = await Promise.all([
    prisma.luaScript.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.luaScript.count({ where }),
  ]);

  return NextResponse.json(
    buildPaginatedResult(scripts, total, page, pageSize),
  );
});

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const body = await request.json();
  const parsed = luaScriptSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 422 },
    );
  }

  const existing = await prisma.luaScript.findUnique({
    where: {
      name_category: { name: parsed.data.name, category: parsed.data.category },
    },
  });
  if (existing && !existing.deletedAt) {
    return NextResponse.json(
      { error: "Já existe um script com esse nome nessa categoria." },
      { status: 409 },
    );
  }

  // Reaproveita a linha soft-deleted em vez de criar uma nova — a constraint única
  // [name, category] continua ocupada por ela mesmo depois do soft delete.
  const luaScript = existing
    ? await prisma.luaScript.update({
        where: { id: existing.id },
        data: { ...parsed.data, deletedAt: null },
      })
    : await prisma.luaScript.create({ data: parsed.data });

  await logAudit({
    accountId: Number(session.user.id),
    action: "create",
    entity: "lua_script",
    entityId: luaScript.id,
    metadata: { name: luaScript.name, category: luaScript.category },
  });

  return NextResponse.json({ luaScript }, { status: 201 });
});
