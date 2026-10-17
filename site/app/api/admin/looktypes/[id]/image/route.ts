import { promises as fs } from "node:fs";

import { NextResponse } from "next/server";
import sharp from "sharp";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { MAX_IMAGE_BYTES, detectImageExtension } from "@/lib/entity-image";
import { looktypeFrameDirPath, looktypeFrameStoragePath } from "@/lib/looktype-storage";
import {
  outfitFrameFieldsFrom,
  writeOutfitDirectionalFrames,
  RESET_OUTFIT_FRAME_FIELDS,
  type OutfitFrameFields,
} from "@/lib/outfit-frame-storage";
import { ObdParseError, parseObd } from "@/lib/obd/obd-parser";
import {
  clampFrameDurationMs,
  renderLooktypeFrames,
  renderOutfitDirectionalFrames,
  type RenderedLooktypeFrame,
} from "@/lib/obd/obd-render";
import { withAudit } from "@/lib/api-audit-wrapper";

/** GIFs animados viram 1 PNG estático por página (`sharp` decodifica cada página/quadro do
 * GIF), cada um com a duração declarada no próprio GIF — sempre limitada a
 * `MAX_FRAME_DURATION_MS` (mesma regra do .obd, ver `obd-render.ts`) pra nenhum formato passar
 * quadros rápido demais na pré-visualização. PNG/JPG estáticos caem no branch de 1 página só. */
async function renderRasterFrames(buffer: Buffer): Promise<RenderedLooktypeFrame[]> {
  const metadata = await sharp(buffer, { animated: true }).metadata();
  const pageCount = metadata.pages ?? 1;

  if (pageCount <= 1) {
    const png = await sharp(buffer).png().toBuffer();
    return [{ png, durationMs: clampFrameDurationMs(100) }];
  }

  const delays = metadata.delay ?? [];
  const frames: RenderedLooktypeFrame[] = [];
  for (let page = 0; page < pageCount; page++) {
    const png = await sharp(buffer, { page, pages: 1 }).png().toBuffer();
    frames.push({ png, durationMs: clampFrameDurationMs(delays[page]) });
  }
  return frames;
}

type Params = { params: Promise<{ id: string }> };

const MAX_OBD_BYTES = 8 * 1024 * 1024;

export const POST = withAudit(async function POST(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id: rawId } = await params;
  const looktypeId = Number(rawId);
  if (!Number.isInteger(looktypeId)) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  const looktype = await prisma.looktype.findUnique({ where: { id: looktypeId } });
  if (!looktype) {
    return NextResponse.json({ error: "Looktype não encontrada." }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 422 });
  }
  const frameSpeedMsRaw = formData.get("frameSpeedMs");
  const frameSpeedMs = frameSpeedMsRaw === null || frameSpeedMsRaw === "" ? null : Number(frameSpeedMsRaw);

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) {
    return NextResponse.json({ error: "Arquivo vazio." }, { status: 422 });
  }

  const imageExtension = detectImageExtension(buffer);

  let frames: { png: Buffer; durationMs: number }[];
  let width = 1;
  let height = 1;
  // Sem direção/máscara por padrão (imagem estática, ou outfit sem a 2ª layer) — só muda quando
  // o arquivo é um `.obd` de outfit de verdade (ver `renderOutfitDirectionalFrames`). Ver
  // `lib/outfit-frame-storage.ts` pro porquê disso ser centralizado: esta rota (substituir o
  // arquivo de um looktype já existente) foi justamente o ponto que ficou pra trás quando essa
  // lógica foi adicionada só na rota de criação em lote.
  let outfitFrameFields: OutfitFrameFields = RESET_OUTFIT_FRAME_FIELDS;
  let outfitDirectional: ReturnType<typeof renderOutfitDirectionalFrames> | null = null;

  if (imageExtension) {
    if (buffer.length > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Imagem maior que 2MB." }, { status: 413 });
    }
    try {
      frames = await renderRasterFrames(buffer);
    } catch {
      return NextResponse.json({ error: "Não foi possível interpretar a imagem." }, { status: 422 });
    }
  } else {
    if (buffer.length > MAX_OBD_BYTES) {
      return NextResponse.json({ error: "Arquivo OBD maior que 8MB." }, { status: 413 });
    }
    try {
      const thing = await parseObd(buffer);
      width = thing.width;
      height = thing.height;
      frames = renderLooktypeFrames(thing, frameSpeedMs);
      if (looktype.category === "outfit") {
        outfitDirectional = renderOutfitDirectionalFrames(thing, frameSpeedMs);
        outfitFrameFields = outfitFrameFieldsFrom(outfitDirectional);
      }
    } catch (error) {
      const message = error instanceof ObdParseError ? error.message : "Não foi possível interpretar o arquivo.";
      return NextResponse.json({ error: message }, { status: 422 });
    }
  }

  const frameDir = looktypeFrameDirPath(looktypeId);
  await fs.rm(frameDir, { recursive: true, force: true });
  await fs.mkdir(frameDir, { recursive: true });

  await Promise.all(
    frames.map((frame, index) => fs.writeFile(looktypeFrameStoragePath(looktypeId, index), frame.png))
  );

  if (outfitDirectional) {
    await writeOutfitDirectionalFrames(looktypeId, outfitDirectional);
  }

  const updated = await prisma.looktype.update({
    where: { id: looktypeId },
    data: {
      width,
      height,
      frameCount: frames.length,
      frameDurationsMs: frames.map((frame) => frame.durationMs),
      directions: outfitFrameFields.directions,
      hasColorMask: outfitFrameFields.hasColorMask,
      addonSlots: outfitFrameFields.addonSlots,
    },
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "looktype",
    entityId: looktypeId,
    metadata: { image: true, frameCount: frames.length },
  });

  return NextResponse.json({ looktype: updated });
});

export const DELETE = withAudit(async function DELETE(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id: rawId } = await params;
  const looktypeId = Number(rawId);
  if (!Number.isInteger(looktypeId)) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  await fs.rm(looktypeFrameDirPath(looktypeId), { recursive: true, force: true });

  const updated = await prisma.looktype.update({
    where: { id: looktypeId },
    data: {
      width: 1,
      height: 1,
      frameCount: 0,
      frameDurationsMs: [],
      directions: RESET_OUTFIT_FRAME_FIELDS.directions,
      hasColorMask: RESET_OUTFIT_FRAME_FIELDS.hasColorMask,
      addonSlots: RESET_OUTFIT_FRAME_FIELDS.addonSlots,
    },
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "delete",
    entity: "looktype",
    entityId: looktypeId,
    metadata: { image: true },
  });

  return NextResponse.json({ looktype: updated });
});
