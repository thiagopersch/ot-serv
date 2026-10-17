import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { buildPaginatedResult, parsePaginationParams } from "@/lib/pagination";
import { AUTOLOOT_CATEGORIES, autolootItemSchema } from "@/lib/validations/admin/autoloot-item";
import { withAudit } from "@/lib/api-audit-wrapper";
import { hasImageIdFilter } from "@/lib/entity-image-filter";

export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const url = new URL(request.url);
  const { page, pageSize, search } = parsePaginationParams(url);

  const publishedParam = url.searchParams.get("published");
  const categoryParam = url.searchParams.get("category");
  const hasImage = await hasImageIdFilter("item", url.searchParams.get("hasImage"));

  const where: Prisma.AutolootItemWhereInput = {
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            Number.isFinite(Number(search)) ? { itemId: Number(search) } : undefined,
          ].filter(Boolean) as Prisma.AutolootItemWhereInput[],
        }
      : {}),
    ...(publishedParam === "true" || publishedParam === "false"
      ? { published: publishedParam === "true" }
      : {}),
    // "auto" = sem tipo forçado (o servidor classifica pelo items.xml).
    ...(categoryParam === "auto"
      ? { category: "" }
      : (AUTOLOOT_CATEGORIES as readonly string[]).includes(categoryParam ?? "")
        ? { category: categoryParam! }
        : {}),
    ...(hasImage ? { itemId: hasImage } : {}),
  };

  const [autolootItems, total] = await Promise.all([
    prisma.autolootItem.findMany({
      where,
      orderBy: [{ category: "asc" }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.autolootItem.count({ where }),
  ]);

  return NextResponse.json(buildPaginatedResult(autolootItems, total, page, pageSize));
});

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const body = await request.json();
  const parsed = autolootItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const existing = await prisma.autolootItem.findUnique({ where: { itemId: parsed.data.itemId } });
  if (existing) {
    return NextResponse.json({ error: "Este item já está na lista." }, { status: 409 });
  }

  const autolootItem = await prisma.autolootItem.create({ data: parsed.data });

  await logAudit({
    accountId: Number(session.user.id),
    action: "create",
    entity: "autoloot_item",
    entityId: autolootItem.id,
    metadata: parsed.data,
  });

  return NextResponse.json({ autolootItem }, { status: 201 });
});
