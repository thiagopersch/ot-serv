import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { buildPaginatedResult, parseIdsParam, parsePaginationParams } from "@/lib/pagination";
import { outfitSchema } from "@/lib/validations/admin/outfit";
import { outfitInclude, outfitInputToPrismaData, outfitsToRows } from "@/lib/outfit-mapper";
import { withAudit } from "@/lib/api-audit-wrapper";

export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const url = new URL(request.url);

  const ids = parseIdsParam(url);
  if (ids) {
    const outfitsById = await prisma.outfitDefinition.findMany({
      where: { id: { in: ids } },
      include: outfitInclude,
    });
    const rows = await outfitsToRows(prisma, outfitsById);
    return NextResponse.json(buildPaginatedResult(rows, rows.length, 1, rows.length || 1));
  }

  const { page, pageSize, search } = parsePaginationParams(url);
  const premium = url.searchParams.get("premium");
  const hasItem = url.searchParams.get("hasItem");
  const hasStorage = url.searchParams.get("hasStorage");
  const storageId = url.searchParams.get("storageId");
  const numericSearch = Number.isInteger(Number(search)) && search !== "" ? Number(search) : null;

  const where: Prisma.OutfitDefinitionWhereInput = {
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            ...(numericSearch !== null
              ? [
                  { id: numericSearch },
                  { unlockItemId: numericSearch },
                  { maleLooktype: { looktypeNumber: numericSearch } },
                  { femaleLooktype: { looktypeNumber: numericSearch } },
                ]
              : []),
          ],
        }
      : {}),
    ...(premium === "true" || premium === "false" ? { premium: premium === "true" } : {}),
    ...(hasItem === "true" ? { unlockItemId: { not: null } } : hasItem === "false" ? { unlockItemId: null } : {}),
    ...(hasStorage === "true" ? { storageId: { not: null } } : hasStorage === "false" ? { storageId: null } : {}),
    ...(storageId ? { storageId } : {}),
  };

  const [outfits, total] = await Promise.all([
    prisma.outfitDefinition.findMany({
      where,
      orderBy: { id: "asc" },
      include: outfitInclude,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.outfitDefinition.count({ where }),
  ]);

  return NextResponse.json(buildPaginatedResult(await outfitsToRows(prisma, outfits), total, page, pageSize));
});

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const parsed = outfitSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 422 });
  }

  const existing = await prisma.outfitDefinition.findUnique({ where: { id: parsed.data.id } });
  if (existing) {
    return NextResponse.json({ error: `Já existe uma outfit com o id ${parsed.data.id}.` }, { status: 409 });
  }

  const outfit = await prisma.outfitDefinition.create({ data: outfitInputToPrismaData(parsed.data) });

  await logAudit({
    accountId: Number(session.user.id),
    action: "create",
    entity: "outfit",
    entityId: outfit.id,
    metadata: { name: outfit.name },
  });

  return NextResponse.json({ outfit }, { status: 201 });
});
