import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { buildPaginatedResult, parsePaginationParams } from "@/lib/pagination";
import { doodadFormSchema } from "@/lib/validations/admin/doodad";
import { doodadFormToContent } from "@/lib/doodad-mapper";
import { assertCategoryForBrush, TilesetIntegrityError } from "@/lib/tileset-integrity";
import { doodadItemIds, idsWithContentArray, idsWithItem } from "@/lib/brush-item-ids";
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
  const { page, pageSize, search } = parsePaginationParams(url);

  const type = url.searchParams.get("type");
  const tilesetCategoryId = url.searchParams.get("tilesetCategoryId");
  const contentShape = url.searchParams.get("contentShape"); // "items" | "composites" | "alternates"

  const searchId = search ? Number(search) : NaN;
  const isNumericSearch = search !== "" && Number.isFinite(searchId);

  // Busca por id de item: além do `server_lookid` (coluna), também casa contra qualquer id
  // usado dentro do conteúdo do brush (items/composites/alternates/carpets/walls/tables) —
  // não dá pra filtrar isso no banco (JSON aninhado), então varre a tabela em memória.
  let contentMatchIds: number[] = [];
  if (isNumericSearch) {
    const candidates = await prisma.doodadBrush.findMany({ select: { id: true, content: true } });
    contentMatchIds = idsWithItem(candidates, doodadItemIds, searchId);
  }

  // Filtro "conteúdo" (itens diretos/composites/alternates): mesma limitação de JSON
  // aninhado — varre a tabela em memória para achar quem tem aquele array não-vazio.
  let contentShapeMatchIds: number[] | null = null;
  if (contentShape === "items" || contentShape === "composites" || contentShape === "alternates") {
    const candidates = await prisma.doodadBrush.findMany({ select: { id: true, content: true } });
    contentShapeMatchIds = idsWithContentArray(candidates, contentShape);
  }

  const where: Prisma.DoodadBrushWhereInput = {
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
    prisma.doodadBrush.findMany({
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
    prisma.doodadBrush.count({ where }),
  ]);

  return NextResponse.json(buildPaginatedResult(brushes, total, page, pageSize));
});

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const body = await request.json();
  const parsed = doodadFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  try {
    await assertCategoryForBrush(parsed.data.tilesetCategoryId, "doodad");

    const existingNames = await prisma.doodadBrush.findMany({ select: { id: true, name: true } });
    if (hasDuplicateName(existingNames, parsed.data.name)) {
      return NextResponse.json({ error: "Já existe um doodad com esse nome." }, { status: 409 });
    }

    const brush = await prisma.doodadBrush.create({
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
        content: doodadFormToContent(parsed.data),
        tilesetCategoryId: parsed.data.tilesetCategoryId,
      },
    });

    await logAudit({
      accountId: Number(session.user.id),
      action: "create",
      entity: "doodad_brush",
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
