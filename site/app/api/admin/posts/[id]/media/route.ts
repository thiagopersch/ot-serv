import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";

import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { MAX_POST_MEDIA_BYTES, detectPostMedia, postMediaStorageDir, postMediaUrl } from "@/lib/post-media";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const POST = withAudit(async function POST(request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) {
    return NextResponse.json({ error: "Post não encontrado." }, { status: 404 });
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
  if (buffer.length > MAX_POST_MEDIA_BYTES) {
    return NextResponse.json({ error: "Arquivo maior que 25MB." }, { status: 413 });
  }

  const detected = detectPostMedia(buffer);
  if (!detected) {
    return NextResponse.json(
      { error: "Formato inválido — envie uma imagem (png/gif/jpg/webp), vídeo (mp4/webm) ou áudio (mp3/wav/ogg)." },
      { status: 422 }
    );
  }

  const filename = `${randomUUID()}.${detected.extension}`;
  const dir = postMediaStorageDir(postId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(`${dir}/${filename}`, buffer);

  return NextResponse.json({
    url: postMediaUrl(postId, filename),
    kind: detected.kind,
  });
});
