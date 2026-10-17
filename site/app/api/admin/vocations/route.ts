import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { buildPaginatedResult, parseIdsParam, parsePaginationParams } from "@/lib/pagination";
import { vocationSchema } from "@/lib/validations/admin/vocation";
import { vocationInputToPrismaData, vocationToInput } from "@/lib/vocation-mapper";
import { hasImageIdFilter } from "@/lib/entity-image-filter";
import { withAudit } from "@/lib/api-audit-wrapper";

export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const url = new URL(request.url);

  const ids = parseIdsParam(url);
  if (ids) {
    const vocationsById = await prisma.vocation.findMany({ where: { id: { in: ids } } });
    return NextResponse.json(buildPaginatedResult(vocationsById, vocationsById.length, 1, vocationsById.length || 1));
  }

  const { page, pageSize, search } = parsePaginationParams(url);
  const archetypeId = url.searchParams.get("archetypeId");
  const typeUniverseId = url.searchParams.get("typeUniverseId");
  const needpremium = url.searchParams.get("needpremium");
  const published = url.searchParams.get("published");
  const publishedGameplay = url.searchParams.get("publishedGameplay");
  const hasImage = await hasImageIdFilter("vocation", url.searchParams.get("hasImage"));

  const where: Prisma.VocationWhereInput = {
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { description: { contains: search } },
          ],
        }
      : {}),
    ...(hasImage ? { id: hasImage } : {}),
    ...(archetypeId ? { archetypeId: Number(archetypeId) } : {}),
    ...(typeUniverseId ? { typeUniverseId: Number(typeUniverseId) } : {}),
    ...(needpremium === "true" || needpremium === "false"
      ? { needpremium: needpremium === "true" }
      : {}),
    ...(published === "true" || published === "false" ? { published: published === "true" } : {}),
    ...(publishedGameplay === "true" || publishedGameplay === "false"
      ? { publishedGameplay: publishedGameplay === "true" }
      : {}),
  };

  const [vocations, total] = await Promise.all([
    prisma.vocation.findMany({
      where,
      orderBy: { id: "asc" },
      include: { archetype: true, typeUniverse: true },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.vocation.count({ where }),
  ]);

  return NextResponse.json(
    buildPaginatedResult(
      vocations.map((vocation) => ({
        ...vocationToInput(vocation),
        archetypeName: vocation.archetype?.name ?? "",
        typeUniverseName: vocation.typeUniverse?.name ?? "",
        typeUniverseColor: vocation.typeUniverse?.color ?? null,
      })),
      total,
      page,
      pageSize
    )
  );
});

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const body = await request.json();
  const parsed = vocationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const existing = await prisma.vocation.findUnique({ where: { id: parsed.data.id } });
  if (existing) {
    return NextResponse.json({ error: "Já existe uma vocação com esse id." }, { status: 409 });
  }

  const vocation = await prisma.vocation.create({ data: vocationInputToPrismaData(parsed.data) });

  await logAudit({
    accountId: Number(session.user.id),
    action: "create",
    entity: "vocation",
    entityId: vocation.id,
    metadata: { name: vocation.name },
  });

  return NextResponse.json({ vocation: vocationToInput(vocation) }, { status: 201 });
});
