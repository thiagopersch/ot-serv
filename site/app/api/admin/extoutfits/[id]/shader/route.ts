import { promises as fs } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { MAX_IMAGE_BYTES, detectImageExtension } from "@/lib/entity-image";
import { MAX_SHADER_BYTES, shaderTex1StoragePath } from "@/lib/extoutfit-shader-storage";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

async function findShader(id: string) {
  const entry = await prisma.extOutfit.findUnique({ where: { id: Number(id) } });
  return entry && entry.kind === "shaders" ? entry : null;
}

async function unlinkIfExists(filePath: string) {
  await fs.unlink(filePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}

/** `?part=fragment|vertex` — conteúdo do `.frag` (download por padrão; `?inline=1` devolve texto
 * puro para o preview WebGL). */
export const GET = withAudit(async function GET(request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const entry = await findShader(id);
  if (!entry) return NextResponse.json({ error: "Shader não encontrado." }, { status: 404 });

  const url = new URL(request.url);
  const part = url.searchParams.get("part") === "vertex" ? "vertex" : "fragment";
  const source = part === "vertex" ? entry.shaderVertexSource : entry.shaderSource;
  if (!source) return NextResponse.json({ error: "Arquivo não enviado." }, { status: 404 });

  const baseName = entry.shaderName ?? `shader_${entry.id}`;
  const fileName =
    part === "vertex" ? `${baseName}_vertex.frag` : (entry.shaderFileName ?? `${baseName}.frag`);

  return new Response(source, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...(url.searchParams.get("inline") === "1"
        ? {}
        : { "Content-Disposition": `attachment; filename="${fileName.replace(/"/g, "")}"` }),
    },
  });
});

/** Multipart com `fragment`, `vertex` e/ou `tex1` (PNG/GIF da textura `u_Tex1`). */
export const PUT = withAudit(async function PUT(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const entry = await findShader(id);
  if (!entry) return NextResponse.json({ error: "Shader não encontrado." }, { status: 404 });

  const formData = await request.formData();
  const fragment = formData.get("fragment");
  const vertex = formData.get("vertex");
  const tex1 = formData.get("tex1");

  const data: {
    shaderSource?: string;
    shaderFileName?: string;
    shaderVertexSource?: string;
    shaderTex1Ext?: string;
  } = {};

  for (const [file, label] of [
    [fragment, "fragment"],
    [vertex, "vertex"],
  ] as const) {
    if (!(file instanceof File)) continue;
    if (file.size === 0 || file.size > MAX_SHADER_BYTES) {
      return NextResponse.json({ error: `Arquivo ${label} vazio ou maior que 256KB.` }, { status: 422 });
    }
    const text = await file.text();
    if (label === "fragment") {
      data.shaderSource = text;
      data.shaderFileName = file.name.replace(/^.*[\\/]/, "").slice(0, 120);
    } else {
      data.shaderVertexSource = text;
    }
  }

  if (tex1 instanceof File) {
    const buffer = Buffer.from(await tex1.arrayBuffer());
    const extension = detectImageExtension(buffer);
    if (!extension) return NextResponse.json({ error: "A textura deve ser PNG ou GIF." }, { status: 422 });
    if (buffer.length > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Textura maior que 2MB." }, { status: 413 });
    }
    if (entry.shaderTex1Ext && entry.shaderTex1Ext !== extension) {
      await unlinkIfExists(shaderTex1StoragePath(entry.id, entry.shaderTex1Ext));
    }
    const storagePath = shaderTex1StoragePath(entry.id, extension);
    await fs.mkdir(path.dirname(storagePath), { recursive: true });
    await fs.writeFile(storagePath, buffer);
    data.shaderTex1Ext = extension;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 422 });
  }

  // `updatedAt` muda sempre (cache-busting da textura), mesmo que só a textura tenha mudado.
  await prisma.extOutfit.update({ where: { id: entry.id }, data });

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "extoutfit_shader",
    entityId: entry.id,
    metadata: { parts: Object.keys(data) },
  });

  return NextResponse.json({ success: true });
});

/** `?part=fragment|vertex|tex1`. */
export const DELETE = withAudit(async function DELETE(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const entry = await findShader(id);
  if (!entry) return NextResponse.json({ error: "Shader não encontrado." }, { status: 404 });

  const part = new URL(request.url).searchParams.get("part");
  if (part === "fragment") {
    await prisma.extOutfit.update({ where: { id: entry.id }, data: { shaderSource: null, shaderFileName: null } });
  } else if (part === "vertex") {
    await prisma.extOutfit.update({ where: { id: entry.id }, data: { shaderVertexSource: null } });
  } else if (part === "tex1") {
    if (entry.shaderTex1Ext) await unlinkIfExists(shaderTex1StoragePath(entry.id, entry.shaderTex1Ext));
    await prisma.extOutfit.update({ where: { id: entry.id }, data: { shaderTex1Ext: null } });
  } else {
    return NextResponse.json({ error: "Parte inválida." }, { status: 422 });
  }

  await logAudit({
    accountId: Number(session.user.id),
    action: "delete",
    entity: "extoutfit_shader",
    entityId: entry.id,
    metadata: { part },
  });

  return NextResponse.json({ success: true });
});
