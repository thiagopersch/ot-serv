import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { buildPaginatedResult, parseIdsParam, parsePaginationParams } from "@/lib/pagination";
import { townFormSchema } from "@/lib/validations/admin/town";
import { townToFormInput } from "@/lib/town-mapper";
import { withAudit } from "@/lib/api-audit-wrapper";

export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const url = new URL(request.url);

  const ids = parseIdsParam(url);
  if (ids) {
    const townsById = await prisma.town.findMany({ where: { id: { in: ids } } });
    return NextResponse.json(buildPaginatedResult(townsById, townsById.length, 1, townsById.length || 1));
  }

  if (url.searchParams.get("all") === "true") {
    const towns = await prisma.town.findMany({
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    });
    return NextResponse.json({ data: towns });
  }

  const { page, pageSize, search } = parsePaginationParams(url);
  const published = url.searchParams.get("published");

  const searchId = search ? Number(search) : NaN;
  const isNumericSearch = search !== "" && Number.isFinite(searchId);

  const where: Prisma.TownWhereInput = {
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            ...(isNumericSearch ? [{ id: searchId }] : []),
          ],
        }
      : {}),
    ...(published === "true" || published === "false" ? { published: published === "true" } : {}),
  };

  const [towns, total] = await Promise.all([
    prisma.town.findMany({
      where,
      orderBy: { id: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.town.count({ where }),
  ]);

  return NextResponse.json(buildPaginatedResult(towns, total, page, pageSize));
});

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const body = await request.json();
  const parsed = townFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const existing = await prisma.town.findUnique({ where: { id: parsed.data.id } });
  if (existing) {
    return NextResponse.json({ error: "Já existe uma town com esse id." }, { status: 409 });
  }

  const town = await prisma.town.create({
    data: {
      id: parsed.data.id,
      name: parsed.data.name,
      templeX: parsed.data.templeX,
      templeY: parsed.data.templeY,
      templeZ: parsed.data.templeZ,
      published: parsed.data.published,
    },
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "create",
    entity: "town",
    entityId: town.id,
    metadata: { name: town.name },
  });

  return NextResponse.json({ town: townToFormInput(town) }, { status: 201 });
});
