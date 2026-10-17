import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { buildPaginatedResult, parsePaginationParams } from "@/lib/pagination";
import { questInputToPrismaData, questSchema } from "@/lib/validations/admin/quest";
import { withAudit } from "@/lib/api-audit-wrapper";

export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const url = new URL(request.url);
  const { page, pageSize, search } = parsePaginationParams(url);

  const where: Prisma.QuestWhereInput = search ? { name: { contains: search } } : {};

  const [entries, total] = await Promise.all([
    prisma.quest.findMany({
      where,
      orderBy: { id: "desc" },
      include: { categoryRef: true },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.quest.count({ where }),
  ]);

  return NextResponse.json(buildPaginatedResult(entries, total, page, pageSize));
});

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const body = await request.json();
  const parsed = questSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const category = await prisma.category.findUnique({ where: { id: parsed.data.categoryId } });
  if (!category) {
    return NextResponse.json({ error: "Categoria não encontrada." }, { status: 422 });
  }

  const entry = await prisma.quest.create({
    data: questInputToPrismaData(parsed.data, category.name),
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "create",
    entity: "quest",
    entityId: entry.id,
    metadata: { name: entry.name },
  });

  return NextResponse.json({ entry }, { status: 201 });
});
