import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { buildPaginatedResult, parsePaginationParams } from "@/lib/pagination";
import { tilesetFormSchema } from "@/lib/validations/admin/tileset";
import { tilesetToFormInput } from "@/lib/tileset-mapper";
import { assertUniqueTilesetName, TilesetIntegrityError } from "@/lib/tileset-integrity";
import { doodadItemIds, groundItemIds, idsWithItem, wallItemIds } from "@/lib/brush-item-ids";
import { withAudit } from "@/lib/api-audit-wrapper";

export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const url = new URL(request.url);
  const { page, pageSize, search } = parsePaginationParams(url);

  const searchId = search ? Number(search) : NaN;
  const isNumericSearch = search !== "" && Number.isFinite(searchId);

  // Busca por id de item: casa contra `server_lookid` (coluna) e contra qualquer id usado
  // dentro do conteúdo de cada brush vinculado (composites/alternates/etc.) — não dá pra
  // filtrar JSON aninhado no banco, então varre as 3 tabelas de brush em memória.
  let groundContentMatchIds: number[] = [];
  let wallContentMatchIds: number[] = [];
  let doodadContentMatchIds: number[] = [];
  if (isNumericSearch) {
    const [groundCandidates, wallCandidates, doodadCandidates] = await Promise.all([
      prisma.ground.findMany({ select: { id: true, items: true } }),
      prisma.wallBrush.findMany({ select: { id: true, content: true } }),
      prisma.doodadBrush.findMany({ select: { id: true, content: true } }),
    ]);
    groundContentMatchIds = idsWithItem(groundCandidates, groundItemIds, searchId);
    wallContentMatchIds = idsWithItem(wallCandidates, wallItemIds, searchId);
    doodadContentMatchIds = idsWithItem(doodadCandidates, doodadItemIds, searchId);
  }

  const where: Prisma.TilesetWhereInput = search
    ? {
        OR: [
          { name: { contains: search } },
          { categories: { some: { grounds: { some: { name: { contains: search } } } } } },
          { categories: { some: { walls: { some: { name: { contains: search } } } } } },
          { categories: { some: { doodads: { some: { name: { contains: search } } } } } },
          ...(isNumericSearch
            ? [
                { categories: { some: { grounds: { some: { id: searchId } } } } },
                { categories: { some: { walls: { some: { id: searchId } } } } },
                { categories: { some: { doodads: { some: { id: searchId } } } } },
                { categories: { some: { grounds: { some: { serverLookId: searchId } } } } },
                { categories: { some: { walls: { some: { serverLookId: searchId } } } } },
                { categories: { some: { doodads: { some: { serverLookId: searchId } } } } },
                { categories: { some: { grounds: { some: { id: { in: groundContentMatchIds } } } } } },
                { categories: { some: { walls: { some: { id: { in: wallContentMatchIds } } } } } },
                { categories: { some: { doodads: { some: { id: { in: doodadContentMatchIds } } } } } },
                {
                  categories: {
                    some: {
                      itemEntries: {
                        some: {
                          OR: [
                            { itemId: searchId },
                            { AND: [{ fromId: { lte: searchId } }, { toId: { gte: searchId } }] },
                          ],
                        },
                      },
                    },
                  },
                },
              ]
            : []),
        ],
      }
    : {};

  const [tilesets, total] = await Promise.all([
    prisma.tileset.findMany({
      where,
      orderBy: [{ order: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { categories: true } },
        categories: { select: { name: true }, orderBy: { order: "asc" } },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.tileset.count({ where }),
  ]);

  return NextResponse.json(buildPaginatedResult(tilesets, total, page, pageSize));
});

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const body = await request.json();
  const parsed = tilesetFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  try {
    await assertUniqueTilesetName(parsed.data.name);

    const tileset = await prisma.tileset.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        order: parsed.data.order,
        active: parsed.data.active,
        icon: parsed.data.icon,
        rawIdsInBrush: parsed.data.rawIdsInBrush,
      },
    });

    await logAudit({
      accountId: Number(session.user.id),
      action: "create",
      entity: "tileset",
      entityId: tileset.id,
      metadata: { name: tileset.name },
    });

    return NextResponse.json({ tileset: tilesetToFormInput(tileset) }, { status: 201 });
  } catch (error) {
    if (error instanceof TilesetIntegrityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
});
