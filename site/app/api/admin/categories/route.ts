import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { buildPaginatedResult, parsePaginationParams } from "@/lib/pagination";
import { categorySchema } from "@/lib/validations/admin/category";
import { hasDuplicateName } from "@/lib/unique-name";
import { withAudit } from "@/lib/api-audit-wrapper";

export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const url = new URL(request.url);
  const { page, pageSize, search } = parsePaginationParams(url);

  const where: Prisma.CategoryWhereInput = search ? { name: { contains: search } } : {};

  const [categories, total] = await Promise.all([
    prisma.category.findMany({ where, orderBy: { name: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.category.count({ where }),
  ]);

  return NextResponse.json(buildPaginatedResult(categories, total, page, pageSize));
});

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const body = await request.json();
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const existingNames = await prisma.category.findMany({ select: { id: true, name: true } });
  if (hasDuplicateName(existingNames, parsed.data.name)) {
    return NextResponse.json({ error: "Já existe uma categoria com esse nome." }, { status: 409 });
  }

  const category = await prisma.category.create({ data: parsed.data });

  await logAudit({
    accountId: Number(session.user.id),
    action: "create",
    entity: "category",
    entityId: category.id,
    metadata: { name: category.name },
  });

  return NextResponse.json({ category }, { status: 201 });
});
