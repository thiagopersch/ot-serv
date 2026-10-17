import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { isEntityImageType, type EntityImageType } from "@/lib/entity-image";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ entityType: string }> };

const MAX_IDS = 500;

/** Busca o `lookTypeId` vinculado de cada entidade (quando o tipo suporta) — usado pra
 * preferir a sprite animada do cadastro de looktypes em vez do snapshot estático salvo em
 * `EntityImage` (ver `link-looktype/route.ts`). `post` não tem esse vínculo. */
async function fetchLookTypeIds(entityType: EntityImageType, ids: number[]): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  let rows: { id: number; lookTypeId: number | null }[];

  switch (entityType) {
    case "item":
      rows = await prisma.item.findMany({ where: { id: { in: ids } }, select: { id: true, lookTypeId: true } });
      break;
    case "spell":
      rows = await prisma.spell.findMany({ where: { id: { in: ids } }, select: { id: true, lookTypeId: true } });
      break;
    case "vocation":
      rows = await prisma.vocation.findMany({ where: { id: { in: ids } }, select: { id: true, lookTypeId: true } });
      break;
    case "monster":
      rows = await prisma.monster.findMany({ where: { id: { in: ids } }, select: { id: true, lookTypeId: true } });
      break;
    case "extoutfit": {
      // Imagem enviada tem precedência sobre a sprite vinculada (wings/auras sempre têm looktype).
      const withImage = new Set(
        (
          await prisma.entityImage.findMany({
            where: { entityType: "extoutfit", entityId: { in: ids } },
            select: { entityId: true },
          })
        ).map((image) => image.entityId),
      );
      rows = (
        await prisma.extOutfit.findMany({ where: { id: { in: ids } }, select: { id: true, looktypeId: true } })
      ).map((row) => ({ id: row.id, lookTypeId: withImage.has(row.id) ? null : row.looktypeId }));
      break;
    }
    case "post":
      return map;
  }

  for (const row of rows) {
    if (row.lookTypeId != null) map.set(row.id, row.lookTypeId);
  }
  return map;
}

export const GET = withAudit(async function GET(request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { entityType: rawEntityType } = await params;
  if (!isEntityImageType(rawEntityType)) {
    return NextResponse.json({ error: "Tipo de entidade inválido." }, { status: 400 });
  }
  const entityType = rawEntityType;

  const url = new URL(request.url);
  const ids = (url.searchParams.get("ids") ?? "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value))
    .slice(0, MAX_IDS);

  if (ids.length === 0) {
    return NextResponse.json({ images: [] });
  }

  const [images, lookTypeIdByEntityId] = await Promise.all([
    prisma.entityImage.findMany({
      where: { entityType, entityId: { in: ids } },
      select: { entityId: true, extension: true, updatedAt: true },
    }),
    fetchLookTypeIds(entityType, ids),
  ]);

  const lookTypeIds = Array.from(new Set(lookTypeIdByEntityId.values()));
  const looktypes = lookTypeIds.length
    ? await prisma.looktype.findMany({
        where: { id: { in: lookTypeIds } },
        select: { id: true, frameCount: true, frameDurationsMs: true, updatedAt: true },
      })
    : [];
  const looktypeById = new Map(looktypes.map((looktype) => [looktype.id, looktype]));

  const imageByEntityId = new Map(images.map((image) => [image.entityId, image]));
  const allIds = new Set([...imageByEntityId.keys(), ...lookTypeIdByEntityId.keys()]);

  const result = Array.from(allIds).map((entityId) => {
    const image = imageByEntityId.get(entityId);
    const lookTypeId = lookTypeIdByEntityId.get(entityId);
    const looktype = lookTypeId != null ? looktypeById.get(lookTypeId) : undefined;

    return {
      entityId,
      extension: image?.extension ?? null,
      updatedAt: image?.updatedAt ?? null,
      looktype:
        looktype && looktype.frameCount > 0
          ? {
              id: looktype.id,
              frameCount: looktype.frameCount,
              frameDurationsMs: looktype.frameDurationsMs,
              updatedAt: looktype.updatedAt,
            }
          : null,
    };
  });

  return NextResponse.json({ images: result });
});
