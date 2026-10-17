import { promises as fs } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import {
  MAX_IMAGE_BYTES,
  detectImageExtension,
  entityImageStoragePath,
  isEntityImageType,
  type EntityImageType,
} from "@/lib/entity-image";
import type { LooktypeCategory } from "@/lib/validations/admin/looktype";
import { looktypeFrameDirPath, looktypeFrameStoragePath } from "@/lib/looktype-storage";
import { outfitFrameFieldsFrom, writeOutfitDirectionalFrames } from "@/lib/outfit-frame-storage";
import { ObdParseError, parseObd } from "@/lib/obd/obd-parser";
import { renderLooktypeFrames, renderOutfitDirectionalFrames } from "@/lib/obd/obd-render";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ entityType: string; id: string }> };

const MAX_OBD_BYTES = 8 * 1024 * 1024;

/** Categoria de looktype equivalente a cada tipo de entidade — usada só quando o arquivo
 * enviado direto no upload da entidade é um `.obd` (ver `createLooktypeFromObd` abaixo). */
const ENTITY_TYPE_TO_LOOKTYPE_CATEGORY: Record<EntityImageType, LooktypeCategory> = {
  item: "item",
  monster: "outfit",
  vocation: "outfit",
  spell: "effect",
  post: "item",
  extoutfit: "outfit",
};

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

async function setLookTypeId(entityType: EntityImageType, entityId: number, lookTypeId: number): Promise<void> {
  switch (entityType) {
    case "item":
      await prisma.item.update({ where: { id: entityId }, data: { lookTypeId } });
      return;
    case "spell":
      await prisma.spell.update({ where: { id: entityId }, data: { lookTypeId } });
      return;
    case "vocation":
      await prisma.vocation.update({ where: { id: entityId }, data: { lookTypeId } });
      return;
    case "monster":
      await prisma.monster.update({ where: { id: entityId }, data: { lookTypeId } });
      return;
    case "extoutfit":
      await prisma.extOutfit.update({ where: { id: entityId }, data: { looktypeId: lookTypeId } });
      return;
    case "post":
      return;
  }
}

/** `.obd` (Object Builder) tem múltiplos frames/animação — o storage de `EntityImage` é um
 * arquivo estático só, então em vez de tentar encaixar isso ali, criamos (ou substituímos) uma
 * looktype dedicada pra essa entidade e linkamos via `lookTypeId`, reaproveitando o mesmo
 * storage/render usado por `/admin/looktypes` e pelo botão "Vincular sprite do cadastro". */
async function createLooktypeFromObd(
  entityType: EntityImageType,
  entityId: number,
  entityName: string | undefined,
  buffer: Buffer,
): Promise<{ id: number } | { error: string; status: number }> {
  if (buffer.length > MAX_OBD_BYTES) {
    return { error: "Arquivo OBD maior que 8MB.", status: 413 };
  }

  let frames: { png: Buffer; durationMs: number }[];
  let width = 1;
  let height = 1;
  const category = ENTITY_TYPE_TO_LOOKTYPE_CATEGORY[entityType];
  // Direção/máscara de cor só fazem sentido pra outfit (monster/vocation) — ver
  // `lib/outfit-frame-storage.ts` (mesma lógica usada pelo upload manual de `.obd` no CRUD de
  // Looktype e pelo import em lote do cliente).
  let outfitDirectional: ReturnType<typeof renderOutfitDirectionalFrames> | null = null;
  try {
    const thing = await parseObd(buffer);
    width = thing.width;
    height = thing.height;
    frames = renderLooktypeFrames(thing);
    if (category === "outfit") {
      outfitDirectional = renderOutfitDirectionalFrames(thing);
    }
  } catch (error) {
    const message = error instanceof ObdParseError ? error.message : "Não foi possível interpretar o arquivo.";
    return { error: message, status: 422 };
  }

  const outfitFrameFields = outfitDirectional
    ? outfitFrameFieldsFrom(outfitDirectional)
    : { directions: 1, hasColorMask: false, addonSlots: 0 };

  const looktype = await prisma.looktype.create({
    data: {
      name: entityName ? `${entityName} (${entityType} #${entityId})` : `${entityType} #${entityId}`,
      category,
      looktypeNumber: null,
      width,
      height,
      frameCount: 0,
      frameDurationsMs: [],
      directions: outfitFrameFields.directions,
      hasColorMask: outfitFrameFields.hasColorMask,
      addonSlots: outfitFrameFields.addonSlots,
    },
  });

  const frameDir = looktypeFrameDirPath(looktype.id);
  await fs.mkdir(frameDir, { recursive: true });
  await Promise.all(frames.map((frame, index) => fs.writeFile(looktypeFrameStoragePath(looktype.id, index), frame.png)));
  if (outfitDirectional) await writeOutfitDirectionalFrames(looktype.id, outfitDirectional);

  const updated = await prisma.looktype.update({
    where: { id: looktype.id },
    data: { frameCount: frames.length, frameDurationsMs: frames.map((frame) => frame.durationMs) },
  });

  return { id: updated.id };
}

async function getEntityName(entityType: EntityImageType, id: number): Promise<string | undefined> {
  switch (entityType) {
    case "item":
      return (await prisma.item.findUnique({ where: { id }, select: { name: true } }))?.name;
    case "monster":
      return (await prisma.monster.findUnique({ where: { id }, select: { name: true } }))?.name;
    case "spell":
      return (await prisma.spell.findUnique({ where: { id }, select: { name: true } }))?.name;
    case "vocation":
      return (await prisma.vocation.findUnique({ where: { id }, select: { name: true } }))?.name;
    case "extoutfit":
      return (await prisma.extOutfit.findUnique({ where: { id }, select: { name: true } }))?.name;
    case "post":
      return undefined;
  }
}

async function unlinkIfExists(filePath: string) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

/** `EntityThumb` prioriza a sprite animada do cadastro de looktypes (`lookTypeId`) sobre o
 * snapshot estático — sem isso, trocar/remover a imagem manualmente não teria efeito visual
 * nenhum enquanto o vínculo antigo com uma looktype continuasse valendo. */
async function clearLookTypeId(entityType: EntityImageType, entityId: number): Promise<void> {
  switch (entityType) {
    case "item":
      await prisma.item.update({ where: { id: entityId }, data: { lookTypeId: null } });
      return;
    case "spell":
      await prisma.spell.update({ where: { id: entityId }, data: { lookTypeId: null } });
      return;
    case "vocation":
      await prisma.vocation.update({ where: { id: entityId }, data: { lookTypeId: null } });
      return;
    case "monster":
      await prisma.monster.update({ where: { id: entityId }, data: { lookTypeId: null } });
      return;
    case "extoutfit":
      // Wings/auras: o looktype é o valor do XML e nunca é limpo por troca de imagem (a imagem
      // enviada só tem precedência no preview). Demais tipos: o vínculo é só sprite de preview.
      await prisma.extOutfit.updateMany({
        where: { id: entityId, kind: { notIn: ["wings", "auras"] } },
        data: { looktypeId: null },
      });
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

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 422 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) {
    return NextResponse.json({ error: "Arquivo vazio." }, { status: 422 });
  }

  const extension = detectImageExtension(buffer);

  if (!extension && entityType === "extoutfit") {
    // Wings/auras: o looktype vinculado é o valor do XML — um `.obd` aqui criaria uma looktype nova
    // sem número e trocaria o XML. A sprite delas vem do cadastro de looktypes.
    const extOutfit = await prisma.extOutfit.findUnique({ where: { id: entityId }, select: { kind: true } });
    if (extOutfit && (extOutfit.kind === "wings" || extOutfit.kind === "auras")) {
      return NextResponse.json(
        { error: "Para wings/auras envie PNG/GIF, ou o .obd no cadastro de looktypes e vincule a looktype." },
        { status: 422 },
      );
    }
  }

  if (!extension) {
    // Não é PNG/GIF — tenta como `.obd` (Object Builder, com animação) antes de rejeitar.
    const entityName = await getEntityName(entityType, entityId);
    const result = await createLooktypeFromObd(entityType, entityId, entityName, buffer);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const existingObd = await prisma.entityImage.findUnique({
      where: { entityType_entityId: { entityType, entityId } },
    });
    if (existingObd) {
      await unlinkIfExists(entityImageStoragePath(entityType, entityId, existingObd.extension));
      await prisma.entityImage.delete({ where: { entityType_entityId: { entityType, entityId } } });
    }

    await setLookTypeId(entityType, entityId, result.id);
    const looktype = await prisma.looktype.findUniqueOrThrow({ where: { id: result.id } });

    await logAudit({
      accountId: Number(session.user.id),
      action: "update",
      entity: "entity_image",
      entityId,
      metadata: { entityType, source: "obd-upload", looktypeId: looktype.id },
    });

    return NextResponse.json({
      image: {
        entityType,
        entityId,
        extension: "png",
        updatedAt: looktype.updatedAt,
        looktype: {
          id: looktype.id,
          frameCount: looktype.frameCount,
          frameDurationsMs: looktype.frameDurationsMs,
          updatedAt: looktype.updatedAt,
        },
      },
    });
  }

  if (buffer.length > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Imagem maior que 2MB." }, { status: 413 });
  }

  const existing = await prisma.entityImage.findUnique({
    where: { entityType_entityId: { entityType, entityId } },
  });
  if (existing && existing.extension !== extension) {
    await unlinkIfExists(entityImageStoragePath(entityType, entityId, existing.extension));
  }

  const storagePath = entityImageStoragePath(entityType, entityId, extension);
  await fs.mkdir(path.dirname(storagePath), { recursive: true });
  await fs.writeFile(storagePath, buffer);

  const image = await prisma.entityImage.upsert({
    where: { entityType_entityId: { entityType, entityId } },
    update: { extension },
    create: { entityType, entityId, extension },
  });
  await clearLookTypeId(entityType, entityId);

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "entity_image",
    entityId,
    metadata: { entityType, extension },
  });

  return NextResponse.json({
    image: { entityType, entityId, extension: image.extension, updatedAt: image.updatedAt, looktype: null },
  });
});

export const DELETE = withAudit(async function DELETE(_request: Request, { params }: Params) {
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

  const existing = await prisma.entityImage.findUnique({
    where: { entityType_entityId: { entityType, entityId } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Esta entidade não tem imagem." }, { status: 404 });
  }

  await unlinkIfExists(entityImageStoragePath(entityType, entityId, existing.extension));
  await prisma.entityImage.delete({ where: { entityType_entityId: { entityType, entityId } } });
  await clearLookTypeId(entityType, entityId);

  await logAudit({
    accountId: Number(session.user.id),
    action: "delete",
    entity: "entity_image",
    entityId,
    metadata: { entityType },
  });

  return NextResponse.json({ success: true });
});
