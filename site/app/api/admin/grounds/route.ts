import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { buildPaginatedResult, parseIdsParam, parsePaginationParams } from "@/lib/pagination";
import { groundFormSchema } from "@/lib/validations/admin/ground";
import { assertCategoryForBrush, TilesetIntegrityError } from "@/lib/tileset-integrity";
import { contentArrayNonEmpty, groundItemIds, idsWithItem } from "@/lib/brush-item-ids";
import { hasDuplicateName } from "@/lib/unique-name";
import { withAudit } from "@/lib/api-audit-wrapper";

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
    const groundsById = await prisma.ground.findMany({ where: { id: { in: ids } } });
    return NextResponse.json(buildPaginatedResult(groundsById, groundsById.length, 1, groundsById.length || 1));
  }

  const { page, pageSize, search } = parsePaginationParams(url);

  const soloOptional = parseBooleanParam(url.searchParams.get("soloOptional"));
  const tilesetCategoryId = url.searchParams.get("tilesetCategoryId");
  const zOrderMin = url.searchParams.get("zOrderMin");
  const zOrderMax = url.searchParams.get("zOrderMax");
  const hasBorders = url.searchParams.get("hasBorders");
  const hasFriends = url.searchParams.get("hasFriends");

  const searchId = search ? Number(search) : NaN;
  const isNumericSearch = search !== "" && Number.isFinite(searchId);

  // Busca por id de item: `server_lookid` (coluna) + qualquer id usado em `items` (grama/
  // tocos do chão) — não dá pra filtrar JSON aninhado no banco, então varre a tabela em
  // memória.
  let contentMatchIds: number[] = [];
  if (isNumericSearch) {
    const candidates = await prisma.ground.findMany({ select: { id: true, items: true } });
    contentMatchIds = idsWithItem(candidates, groundItemIds, searchId);
  }

  // Filtros "possui bordas vinculadas"/"possui friends": `borders`/`friends` são colunas
  // Json (array) — não dá pra filtrar array-não-vazio no banco, então varre em memória.
  let hasBordersMatchIds: number[] | null = null;
  let hasFriendsMatchIds: number[] | null = null;
  if (hasBorders === "true" || hasBorders === "false" || hasFriends === "true" || hasFriends === "false") {
    const candidates = await prisma.ground.findMany({ select: { id: true, borders: true, friends: true } });
    if (hasBorders === "true" || hasBorders === "false") {
      const want = hasBorders === "true";
      hasBordersMatchIds = candidates
        .filter((row) => contentArrayNonEmpty(row, "borders") === want)
        .map((row) => row.id);
    }
    if (hasFriends === "true" || hasFriends === "false") {
      const want = hasFriends === "true";
      hasFriendsMatchIds = candidates
        .filter((row) => contentArrayNonEmpty(row, "friends") === want)
        .map((row) => row.id);
    }
  }

  const where: Prisma.GroundWhereInput = {
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
    ...(soloOptional !== undefined ? { soloOptional } : {}),
    ...(tilesetCategoryId ? { tilesetCategoryId: Number(tilesetCategoryId) } : {}),
    ...(zOrderMin || zOrderMax
      ? {
          zOrder: {
            ...(zOrderMin ? { gte: Number(zOrderMin) } : {}),
            ...(zOrderMax ? { lte: Number(zOrderMax) } : {}),
          },
        }
      : {}),
    ...(hasBordersMatchIds || hasFriendsMatchIds
      ? {
          id: {
            in:
              hasBordersMatchIds && hasFriendsMatchIds
                ? hasBordersMatchIds.filter((id) => hasFriendsMatchIds!.includes(id))
                : (hasBordersMatchIds ?? hasFriendsMatchIds)!,
          },
        }
      : {}),
  };

  const [grounds, total] = await Promise.all([
    prisma.ground.findMany({
      where,
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        serverLookId: true,
        zOrder: true,
        soloOptional: true,
        tilesetCategoryId: true,
        updatedAt: true,
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.ground.count({ where }),
  ]);

  return NextResponse.json(buildPaginatedResult(grounds, total, page, pageSize));
});

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const body = await request.json();
  const parsed = groundFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  try {
    await assertCategoryForBrush(parsed.data.tilesetCategoryId, "terrain");

    const existingNames = await prisma.ground.findMany({ select: { id: true, name: true } });
    if (hasDuplicateName(existingNames, parsed.data.name)) {
      return NextResponse.json({ error: "Já existe um ground com esse nome." }, { status: 409 });
    }

    const ground = await prisma.ground.create({
      data: {
        name: parsed.data.name,
        serverLookId: parsed.data.serverLookId,
        zOrder: parsed.data.zOrder,
        soloOptional: parsed.data.soloOptional,
        items: parsed.data.items,
        borders: parsed.data.borders,
        friends: parsed.data.friends,
        tilesetCategoryId: parsed.data.tilesetCategoryId,
      },
    });

    await logAudit({
      accountId: Number(session.user.id),
      action: "create",
      entity: "ground",
      entityId: ground.id,
      metadata: { name: ground.name },
    });

    return NextResponse.json({ ground }, { status: 201 });
  } catch (error) {
    if (error instanceof TilesetIntegrityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
});
