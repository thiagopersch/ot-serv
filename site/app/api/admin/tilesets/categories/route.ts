import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { TILESET_CATEGORY_KINDS, TILESET_CATEGORY_TYPES } from "@/lib/validations/admin/tileset";
import { withAudit } from "@/lib/api-audit-wrapper";

export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim() ?? "";
  const typeParam = url.searchParams.get("type");
  const kindParam = url.searchParams.get("kind");

  const type = TILESET_CATEGORY_TYPES.find((t) => t === typeParam);
  const kinds = kindParam
    ? kindParam
        .split(",")
        .map((k) => k.trim())
        .filter((k): k is (typeof TILESET_CATEGORY_KINDS)[number] => (TILESET_CATEGORY_KINDS as readonly string[]).includes(k))
    : undefined;

  const where: Prisma.TilesetCategoryWhereInput = {
    ...(type ? { type } : {}),
    ...(kinds && kinds.length > 0 ? { kind: { in: kinds } } : {}),
    ...(search
      ? {
          OR: [{ name: { contains: search } }, { tileset: { name: { contains: search } } }],
        }
      : {}),
  };

  // Sem `take`: o combobox "Categoria do Tileset" (Doodad/Wall/Ground) filtra client-side
  // sobre a lista inteira recebida aqui, então um teto cortaria categorias reais da lista.
  const categories = await prisma.tilesetCategory.findMany({
    where,
    orderBy: [{ tileset: { order: "asc" } }, { order: "asc" }],
    select: {
      id: true,
      name: true,
      kind: true,
      type: true,
      tilesetId: true,
      tileset: { select: { name: true } },
    },
  });

  return NextResponse.json({
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      kind: category.kind,
      type: category.type,
      tilesetId: category.tilesetId,
      tilesetName: category.tileset.name,
      label: `${category.tileset.name} > ${category.name}`,
    })),
  });
});
