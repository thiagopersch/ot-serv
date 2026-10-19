import { promises as fs } from "node:fs";
import path from "node:path";

import sharp from "sharp";

import { HD_SPRITE_SCALE, isHdSpritePath, isMaskSpritePath } from "@/lib/sprite-hd";
import { xbrzScale2x } from "@/lib/xbrz/xbrz";

/**
 * Versão HD (2x) de uma sprite de `public/storage` — ver `lib/sprite-hd.ts`. Gerada na primeira
 * requisição e guardada em `public/storage/hd/<mesmo caminho>` (mesmo volume persistente das
 * sprites); é refeita quando o arquivo original fica mais novo que o cache (reenvio/reimport).
 * Pública como os próprios arquivos de `public/storage`.
 */

const STORAGE_ROOT = path.join(process.cwd(), "public", "storage");
const HD_CACHE_ROOT = path.join(STORAGE_ROOT, "hd");

/** Imagens maiores que isso (capa/arte custom, não sprite) são servidas como estão. */
const MAX_UPSCALE_PIXELS = 512 * 512;

/** Requisições simultâneas da mesma sprite (thumbs montando juntos) esperam a mesma geração. */
const inFlight = new Map<string, Promise<Buffer>>();

/** APNG tem o chunk `acTL` antes do primeiro `IDAT` — o sharp perderia a animação. */
function isAnimatedPng(buffer: Buffer): boolean {
  const actl = buffer.indexOf("acTL");
  return actl !== -1 && actl < buffer.indexOf("IDAT");
}

async function upscale(source: Buffer, nearest: boolean): Promise<Buffer> {
  if (isAnimatedPng(source)) return source;

  const metadata = await sharp(source).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width === 0 || height === 0 || width * height > MAX_UPSCALE_PIXELS) return source;

  if (nearest) {
    return sharp(source)
      .resize(width * HD_SPRITE_SCALE, height * HD_SPRITE_SCALE, { kernel: "nearest" })
      .png()
      .toBuffer();
  }

  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const scaled = xbrzScale2x(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), info.width, info.height);
  return sharp(Buffer.from(scaled.buffer, scaled.byteOffset, scaled.byteLength), {
    raw: { width: info.width * HD_SPRITE_SCALE, height: info.height * HD_SPRITE_SCALE, channels: 4 },
  })
    .png()
    .toBuffer();
}

async function generate(relativePath: string, sourcePath: string, cachePath: string, sourceMtimeMs: number): Promise<Buffer> {
  const cacheStat = await fs.stat(cachePath).catch(() => null);
  if (cacheStat && cacheStat.mtimeMs >= sourceMtimeMs) return fs.readFile(cachePath);

  const hd = await upscale(await fs.readFile(sourcePath), isMaskSpritePath(relativePath));

  // Grava num temporário e renomeia — nunca deixa um PNG pela metade no cache.
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  const tmpPath = `${cachePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpPath, hd);
  await fs.rename(tmpPath, cachePath).catch(async () => {
    await fs.rm(tmpPath, { force: true });
  });
  return hd;
}

type Params = { params: Promise<{ path: string[] }> };

export async function GET(_request: Request, { params }: Params) {
  const { path: segments } = await params;
  const relativePath = segments.join("/");

  if (!isHdSpritePath(relativePath)) {
    return new Response("Not found", { status: 404 });
  }

  const sourcePath = path.join(STORAGE_ROOT, relativePath);
  const cachePath = path.join(HD_CACHE_ROOT, relativePath);

  const sourceStat = await fs.stat(sourcePath).catch(() => null);
  if (!sourceStat) {
    // Sprite removida/substituída por outro formato — limpa o cache órfão.
    await fs.rm(cachePath, { force: true }).catch(() => null);
    return new Response("Not found", { status: 404 });
  }

  let pending = inFlight.get(relativePath);
  if (!pending) {
    pending = generate(relativePath, sourcePath, cachePath, sourceStat.mtimeMs).finally(() => inFlight.delete(relativePath));
    inFlight.set(relativePath, pending);
  }

  let body: Buffer;
  try {
    body = await pending;
  } catch (error) {
    console.error(`Falha ao gerar sprite HD de ${relativePath}`, error);
    return new Response("Erro ao gerar sprite HD.", { status: 500 });
  }

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "image/png",
      // A URL sempre leva `?v=<updatedAt>` (mesmo esquema das URLs estáticas).
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
