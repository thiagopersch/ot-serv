import { promises as fs } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { entityImageStoragePath, isEntityImageType, type EntityImageType } from "@/lib/entity-image";
import { looktypeFrameStoragePath } from "@/lib/looktype-storage";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ entityType: string; id: string }> };

async function entityExists(entityType: EntityImageType, id: number): Promise<boolean> {
  switch (entityType) {
    case "item":
      return (await prisma.item.findUnique({ where: { id }, select: { id: true } })) != null;
    case "monster":
      return (await prisma.monster.findUnique({ where: { id }, select: { id: true } })) != null;
    case "spell":
      return (await prisma.spell.findUnique({ where: { id }, select: { id: true } })) != null;
    case "vocation":
      return (await prisma.vocation.findUnique({ where: { id }, select: { id: true } })) != null;
    case "post":
      return (await prisma.post.findUnique({ where: { id }, select: { id: true } })) != null;
    case "extoutfit":
      return (await prisma.extOutfit.findUnique({ where: { id }, select: { id: true } })) != null;
  }
}

async function unlinkIfExists(filePath: string) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

/**
 * Além de copiar a imagem, grava a referência real no cadastro de cada entidade — é o que
 * alimenta o painel "Vinculado em" na tela da looktype (ver .../looktypes/[id]/usage/route.ts).
 * Monstro usa `lookType` (número cru, mesmo campo que já vai pro monsters.xml — é dado de jogo,
 * não só bookkeeping do portal); os demais usam `lookTypeId` (id do registro).
 */
async function linkEntityToLooktype(
  entityType: EntityImageType,
  entityId: number,
  looktype: { id: number; looktypeNumber: number | null },
) {
  switch (entityType) {
    case "item":
      await prisma.item.update({ where: { id: entityId }, data: { lookTypeId: looktype.id } });
      return;
    case "spell":
      await prisma.spell.update({ where: { id: entityId }, data: { lookTypeId: looktype.id } });
      return;
    case "vocation":
      await prisma.vocation.update({ where: { id: entityId }, data: { lookTypeId: looktype.id } });
      return;
    case "monster":
      if (looktype.looktypeNumber !== null) {
        await prisma.monster.update({ where: { id: entityId }, data: { lookType: looktype.looktypeNumber } });
      }
      return;
    case "extoutfit":
      await prisma.extOutfit.update({ where: { id: entityId }, data: { looktypeId: looktype.id } });
      // Extoutfit dá precedência à imagem enviada sobre a sprite (ver `fetchLookTypeIds` em
      // `images/[entityType]/route.ts`) — o snapshot estático copiado acima esconderia a sprite
      // animada recém-vinculada, então ele é descartado aqui.
      await prisma.entityImage.deleteMany({ where: { entityType: "extoutfit", entityId } });
      await unlinkIfExists(entityImageStoragePath("extoutfit", entityId, "png"));
      return;
    case "post":
      return;
  }
}

export const POST = withAudit(async function POST(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { entityType: rawEntityType, id: rawId } = await params;
  if (!isEntityImageType(rawEntityType)) {
    return NextResponse.json({ error: "Tipo de entidade inválido." }, { status: 400 });
  }
  const entityType = rawEntityType;
  const entityId = Number(rawId);
  if (!Number.isInteger(entityId)) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  if (!(await entityExists(entityType, entityId))) {
    return NextResponse.json({ error: "Entidade não encontrada." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const looktypeId = Number(body?.looktypeId);
  if (!Number.isInteger(looktypeId)) {
    return NextResponse.json({ error: "Looktype inválida." }, { status: 422 });
  }

  const looktype = await prisma.looktype.findUnique({ where: { id: looktypeId } });
  if (!looktype || looktype.frameCount <= 0) {
    return NextResponse.json({ error: "Essa looktype ainda não tem imagem." }, { status: 404 });
  }

  const sourcePath = looktypeFrameStoragePath(looktypeId, 0);
  const buffer = await fs.readFile(sourcePath).catch(() => null);
  if (!buffer) {
    return NextResponse.json({ error: "Não foi possível ler a imagem da looktype." }, { status: 500 });
  }

  const existing = await prisma.entityImage.findUnique({
    where: { entityType_entityId: { entityType, entityId } },
  });
  if (existing && existing.extension !== "png") {
    await unlinkIfExists(entityImageStoragePath(entityType, entityId, existing.extension));
  }

  const storagePath = entityImageStoragePath(entityType, entityId, "png");
  await fs.mkdir(path.dirname(storagePath), { recursive: true });
  await fs.writeFile(storagePath, buffer);

  const image = await prisma.entityImage.upsert({
    where: { entityType_entityId: { entityType, entityId } },
    update: { extension: "png" },
    create: { entityType, entityId, extension: "png" },
  });

  await linkEntityToLooktype(entityType, entityId, looktype);

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "entity_image",
    entityId,
    metadata: { entityType, source: "looktype", looktypeId },
  });

  return NextResponse.json({
    image: {
      entityType,
      entityId,
      extension: image.extension,
      updatedAt: image.updatedAt,
      looktype: {
        id: looktype.id,
        frameCount: looktype.frameCount,
        frameDurationsMs: looktype.frameDurationsMs,
        updatedAt: looktype.updatedAt,
      },
    },
  });
});
