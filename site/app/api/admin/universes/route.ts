import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { buildPaginatedResult, parseIdsParam, parsePaginationParams } from "@/lib/pagination";
import { universeSchema } from "@/lib/validations/admin/universe";
import { hasDuplicateName } from "@/lib/unique-name";
import { withAudit } from "@/lib/api-audit-wrapper";

export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const url = new URL(request.url);

  const ids = parseIdsParam(url);
  if (ids) {
    const universesById = await prisma.universe.findMany({ where: { id: { in: ids } } });
    return NextResponse.json(buildPaginatedResult(universesById, universesById.length, 1, universesById.length || 1));
  }

  const { page, pageSize, search } = parsePaginationParams(url);

  const where: Prisma.UniverseWhereInput = search
    ? {
        OR: [
          { name: { contains: search } },
          ...(Number.isInteger(Number(search)) ? [{ id: Number(search) }] : []),
        ],
      }
    : {};

  const [universes, total] = await Promise.all([
    prisma.universe.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.universe.count({ where }),
  ]);

  return NextResponse.json(buildPaginatedResult(universes, total, page, pageSize));
});

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const body = await request.json();
  const parsed = universeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const existingNames = await prisma.universe.findMany({ select: { id: true, name: true } });
  if (hasDuplicateName(existingNames, parsed.data.name)) {
    return NextResponse.json({ error: "Já existe um universo com esse nome." }, { status: 409 });
  }

  const universe = await prisma.universe.create({ data: parsed.data });

  await logAudit({
    accountId: Number(session.user.id),
    action: "create",
    entity: "universe",
    entityId: universe.id,
    metadata: parsed.data,
  });

  return NextResponse.json({ universe }, { status: 201 });
});
