import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { buildPaginatedResult, parseIdsParam, parsePaginationParams } from "@/lib/pagination";
import { npcCategorySchema } from "@/lib/validations/admin/npc-category";
import { hasDuplicateName } from "@/lib/unique-name";
import { withAudit } from "@/lib/api-audit-wrapper";

export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const url = new URL(request.url);

  const ids = parseIdsParam(url);
  if (ids) {
    const categoriesById = await prisma.npcCategory.findMany({ where: { id: { in: ids } } });
    return NextResponse.json(
      buildPaginatedResult(categoriesById, categoriesById.length, 1, categoriesById.length || 1),
    );
  }

  const { page, pageSize, search } = parsePaginationParams(url);

  const where: Prisma.NpcCategoryWhereInput = search ? { name: { contains: search } } : {};

  const [categories, total] = await Promise.all([
    prisma.npcCategory.findMany({ where, orderBy: { name: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.npcCategory.count({ where }),
  ]);

  return NextResponse.json(buildPaginatedResult(categories, total, page, pageSize));
});

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const body = await request.json();
  const parsed = npcCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const existingNames = await prisma.npcCategory.findMany({ select: { id: true, name: true } });
  if (hasDuplicateName(existingNames, parsed.data.name)) {
    return NextResponse.json({ error: "Já existe uma categoria com esse nome." }, { status: 409 });
  }

  const category = await prisma.npcCategory.create({
    data: { ...parsed.data, description: parsed.data.description || null },
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "create",
    entity: "npc_category",
    entityId: category.id,
    metadata: { name: category.name },
  });

  return NextResponse.json({ category }, { status: 201 });
});
