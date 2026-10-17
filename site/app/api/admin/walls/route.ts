import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { buildPaginatedResult, parseIdsParam, parsePaginationParams } from "@/lib/pagination";
import { wallFormSchema } from "@/lib/validations/admin/wall";
import { wallFormToContent } from "@/lib/wall-mapper";
import { assertCategoryForBrush, TilesetIntegrityError } from "@/lib/tileset-integrity";
import { idsWithContentArray, idsWithItem, wallItemIds } from "@/lib/brush-item-ids";
import { hasDuplicateName } from "@/lib/unique-name";
import { withAudit } from "@/lib/api-audit-wrapper";

const BOOLEAN_FILTER_KEYS = [
  "draggable",
  "onBlocking",
  "onDuplicate",
  "oneSize",
  "redoBorders",
  "reborder",
] as const;

function parseBooleanParam(value: string | null): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const url = new URL(request.url);

  const ids = parseIdsParam(url);
  if (ids) {
    const wallsById = await prisma.wallBrush.findMany({ where: { id: { in: ids } } });
    return NextResponse.json(buildPaginatedResult(wallsById, wallsById.length, 1, wallsById.length || 1));
  }

  const { page, pageSize, search } = parsePaginationParams(url);

  const type = url.searchParams.get("type");
  const tilesetCategoryId = url.searchParams.get("tilesetCategoryId");
  const contentShape = url.searchParams.get("contentShape"); // "walls" | "items" | "composites" | "alternates"

  const searchId = search ? Number(search) : NaN;
  const isNumericSearch = search !== "" && Number.isFinite(searchId);

  // Busca por id de item: `server_lookid` (coluna) + qualquer id usado dentro do conteúdo
  // (walls/items/composites/alternates) — não dá pra filtrar JSON aninhado no banco, então
  // varre a tabela em memória.
  let contentMatchIds: number[] = [];
  if (isNumericSearch) {
    const candidates = await prisma.wallBrush.findMany({ select: { id: true, content: true } });
    contentMatchIds = idsWithItem(candidates, wallItemIds, searchId);
  }

  // Filtro "conteúdo" (segmentos de parede/itens diretos/composites/alternates): mesma
  // limitação de JSON aninhado — varre a tabela em memória.
  let contentShapeMatchIds: number[] | null = null;
  if (
    contentShape === "walls" ||
    contentShape === "items" ||
    contentShape === "composites" ||
    contentShape === "alternates"
  ) {
    const candidates = await prisma.wallBrush.findMany({ select: { id: true, content: true } });
    contentShapeMatchIds = idsWithContentArray(candidates, contentShape);
  }

  const where: Prisma.WallBrushWhereInput = {
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            ...(isNumericSearch
              ? [{ serverLookId: searchId }, { id: { in: contentMatchIds } }]
              : []),
          ],
        }
      : {}),
    ...(type ? { type } : {}),
    ...(tilesetCategoryId ? { tilesetCategoryId: Number(tilesetCategoryId) } : {}),
    ...(contentShapeMatchIds ? { id: { in: contentShapeMatchIds } } : {}),
    ...Object.fromEntries(
      BOOLEAN_FILTER_KEYS.map((key) => [key, parseBooleanParam(url.searchParams.get(key))]).filter(
        ([, value]) => value !== undefined
      )
    ),
  };

  const [brushes, total] = await Promise.all([
    prisma.wallBrush.findMany({
      where,
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        type: true,
        serverLookId: true,
        draggable: true,
        onBlocking: true,
        onDuplicate: true,
        oneSize: true,
        redoBorders: true,
        reborder: true,
        thickness: true,
        tilesetCategoryId: true,
        updatedAt: true,
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.wallBrush.count({ where }),
  ]);

  return NextResponse.json(buildPaginatedResult(brushes, total, page, pageSize));
});

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const body = await request.json();
  const parsed = wallFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  try {
    await assertCategoryForBrush(parsed.data.tilesetCategoryId, "terrain");

    const existingNames = await prisma.wallBrush.findMany({ select: { id: true, name: true } });
    if (hasDuplicateName(existingNames, parsed.data.name)) {
      return NextResponse.json({ error: "Já existe uma wall com esse nome." }, { status: 409 });
    }

    const brush = await prisma.wallBrush.create({
      data: {
        name: parsed.data.name,
        type: parsed.data.type,
        serverLookId: parsed.data.serverLookId,
        draggable: parsed.data.draggable,
        onBlocking: parsed.data.onBlocking,
        thickness: parsed.data.thickness,
        onDuplicate: parsed.data.onDuplicate,
        oneSize: parsed.data.oneSize,
        redoBorders: parsed.data.redoBorders,
        reborder: parsed.data.reborder,
        content: wallFormToContent(parsed.data),
        friends: parsed.data.friends,
        tilesetCategoryId: parsed.data.tilesetCategoryId,
      },
    });

    await logAudit({
      accountId: Number(session.user.id),
      action: "create",
      entity: "wall_brush",
      entityId: brush.id,
      metadata: { name: brush.name, type: brush.type },
    });

    return NextResponse.json({ brush }, { status: 201 });
  } catch (error) {
    if (error instanceof TilesetIntegrityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
});
