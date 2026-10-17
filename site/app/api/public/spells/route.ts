import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { buildPaginatedResult, parsePaginationParams } from "@/lib/pagination";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { page, pageSize, search } = parsePaginationParams(url);
  const levelMax = url.searchParams.get("levelMax");
  const vocationId = url.searchParams.get("vocationId");
  const group = url.searchParams.get("group");

  const where: Prisma.SpellWhereInput = {
    published: true,
    ...(search ? { name: { contains: search } } : {}),
    ...(levelMax ? { level: { lte: Number(levelMax) } } : {}),
    ...(group ? { group: { contains: group } } : {}),
    ...(vocationId
      ? {
          OR: [
            { vocations: { some: { vocationId: Number(vocationId) } } },
            // Spell sem nenhuma vocação vinculada = disponível para todas — sempre aparece.
            { vocations: { none: {} } },
          ],
        }
      : {}),
  };

  const [spells, total] = await Promise.all([
    prisma.spell.findMany({
      where,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        level: true,
        mana: true,
        description: true,
        vocations: { select: { vocation: { select: { name: true } } } },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.spell.count({ where }),
  ]);

  const ids = spells.map((spell) => spell.id);
  const images = ids.length
    ? await prisma.entityImage.findMany({
        where: { entityType: "spell", entityId: { in: ids } },
        select: { entityId: true, extension: true, updatedAt: true },
      })
    : [];
  const imageByEntityId = new Map(
    images.map((image) => [image.entityId, image]),
  );

  return NextResponse.json(
    buildPaginatedResult(
      spells.map((spell) => ({
        id: spell.id,
        name: spell.name,
        level: spell.level,
        mana: spell.mana,
        description: spell.description,
        vocationNames: spell.vocations.map((entry) => entry.vocation.name),
        image: imageByEntityId.get(spell.id) ?? null,
      })),
      total,
      page,
      pageSize,
    ),
  );
}
