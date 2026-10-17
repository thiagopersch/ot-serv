"use client";

import { useEffect, useRef } from "react";

import { looktypeFrameUrl, looktypeOutfitLayerUrl } from "@/lib/looktype-storage";
import { OUTFIT_MASK_REGION_COLORS, getOutfitPaletteColor, type Rgb } from "@/lib/tibia-outfit-color";
import { OutfitShaderRenderer, type ShaderColor } from "@/lib/shader-preview/webgl-outfit-shader";
import { animatedFrameAt, decodeApng, type AnimatedImage } from "@/lib/apng-decoder";

/** Sprite do cadastro de looktypes com os campos de camada/direção (`Looktype`). */
export type CompositeLooktype = {
  id: number;
  frameCount: number;
  frameDurationsMs: number[];
  updatedAt: string;
  directions: number;
  hasColorMask: boolean;
  addonSlots: number;
};

/** Camada extra (wings/aura/barra): imagem enviada tem precedência sobre a sprite vinculada. */
export type CompositeLayer = {
  imageUrl: string | null;
  looktype: CompositeLooktype | null;
  offsetX: number;
  offsetY: number;
};

export type CompositeShader = {
  fragment: string;
  vertex: string | null;
  tex1Url: string | null;
};

export type OutfitColorsInput = { head: number; body: number; legs: number; feet: number };

type OutfitCompositePreviewProps = {
  outfit: CompositeLooktype | null;
  /** 0=Norte, 1=Leste, 2=Sul, 3=Oeste. */
  direction: number;
  addons: number;
  colors: OutfitColorsInput;
  animate: boolean;
  zoom: number;
  wings?: CompositeLayer | null;
  aura?: (CompositeLayer & { front: boolean }) | null;
  shader?: CompositeShader | null;
  healthBar?: CompositeLayer | null;
  manaBar?: CompositeLayer | null;
  onShaderError?: (error: string | null) => void;
};

const CANVAS_WIDTH = 224;
const CANVAS_HEIGHT = 208;
/** Canto inferior direito do tile da criatura — sprites do Tibia crescem para cima/esquerda a
 * partir dele (mesma ancoragem do `ThingType::draw`). */
const ANCHOR_X = 136;
const ANCHOR_Y = 176;
const BAR_WIDTH = 40;
const COLOR_MATCH_TOLERANCE = 40;

type CachedImage = HTMLImageElement | "loading" | "error";
const imageCache = new Map<string, CachedImage>();

function getImage(url: string): HTMLImageElement | null {
  const cached = imageCache.get(url);
  if (cached instanceof HTMLImageElement) return cached;
  if (cached) return null;
  imageCache.set(url, "loading");
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => imageCache.set(url, img);
  img.onerror = () => imageCache.set(url, "error");
  img.src = url;
  return null;
}

function isFailed(url: string) {
  return imageCache.get(url) === "error";
}

type Drawable = HTMLImageElement | HTMLCanvasElement;
type CachedUpload = AnimatedImage | HTMLImageElement | "loading" | "error";
const uploadCache = new Map<string, CachedUpload>();

/** Imagem enviada (wings/aura/barra) no instante `ms` — APNG é decodificado frame a frame
 * (`drawImage` de um `<img>` APNG só pinta o primeiro frame); PNG estático/GIF vão como imagem. */
function uploadedFrame(url: string, ms: number, animate: boolean): Drawable | null {
  const cached = uploadCache.get(url);
  if (cached instanceof HTMLImageElement) return cached;
  if (cached && typeof cached === "object") return animate ? animatedFrameAt(cached, ms) : cached.frames[0].canvas;
  if (cached) return null;

  uploadCache.set(url, "loading");
  fetch(url)
    .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(String(response.status)))))
    .then(async (buffer) => {
      const animated = await decodeApng(buffer).catch(() => null);
      if (animated) {
        uploadCache.set(url, animated);
        return;
      }
      const img = new Image();
      img.onload = () => uploadCache.set(url, img);
      img.onerror = () => uploadCache.set(url, "error");
      img.src = url;
    })
    .catch(() => uploadCache.set(url, "error"));
  return null;
}

function sizeOf(image: Drawable) {
  return image instanceof HTMLImageElement
    ? { width: image.naturalWidth, height: image.naturalHeight }
    : { width: image.width, height: image.height };
}

/** Primeira URL disponível dentre as candidatas (camada por direção → frame genérico). */
function firstAvailable(urls: string[]): HTMLImageElement | null {
  for (const url of urls) {
    const img = getImage(url);
    if (img) return img;
    if (!isFailed(url)) return null; // ainda carregando — espera antes de cair no fallback
  }
  return null;
}

function looktypeLayer(
  looktype: CompositeLooktype,
  direction: number,
  slot: number,
  layer: "base" | "mask",
  frame: number,
): HTMLImageElement | null {
  const updated = new Date(looktype.updatedAt);
  const dir = looktype.directions > 1 ? direction : 0;
  const urls = [looktypeOutfitLayerUrl(looktype.id, dir, slot, layer, frame, updated)];
  if (layer === "base" && slot === 0) urls.push(looktypeFrameUrl(looktype.id, frame, updated));
  return firstAvailable(urls);
}

/** Frame da animação para o instante `ms` — ciclo pelos `frameDurationsMs` da sprite. */
function frameAt(looktype: CompositeLooktype, ms: number, animate: boolean): number {
  if (!animate || looktype.frameCount <= 1) return 0;
  const durations = Array.from({ length: looktype.frameCount }, (_, i) =>
    Math.max(50, Math.min(looktype.frameDurationsMs[i] || 100, 1000)),
  );
  let t = ms % durations.reduce((sum, d) => sum + d, 0);
  for (let i = 0; i < durations.length; i++) {
    if (t < durations[i]) return i;
    t -= durations[i];
  }
  return 0;
}

/** Aura/wings "animate always" no cliente: ciclo completo em 1 s. */
function cycleFrame(frameCount: number, ms: number, animate: boolean): number {
  if (!animate || frameCount <= 1) return 0;
  return Math.floor((ms % 1000) / (1000 / frameCount)) % frameCount;
}

const recolorCache = new Map<string, HTMLCanvasElement>();

/** Base + recoloração 2D da máscara (mesmo algoritmo de `OutfitColorPreview`), em cache. */
function recolored(base: HTMLImageElement, mask: HTMLImageElement | null, colors: OutfitColorsInput): HTMLCanvasElement {
  const key = `${base.src}|${mask?.src ?? ""}|${colors.head},${colors.body},${colors.legs},${colors.feet}`;
  const cached = recolorCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = base.naturalWidth;
  canvas.height = base.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(base, 0, 0);

  if (mask) {
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = mask.naturalWidth;
    maskCanvas.height = mask.naturalHeight;
    const maskCtx = maskCanvas.getContext("2d")!;
    maskCtx.drawImage(mask, 0, 0);
    const src = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;

    for (const region of ["head", "body", "legs", "feet"] as const) {
      const tint = getOutfitPaletteColor(colors[region]);
      if (!tint) continue;
      const target: Rgb = OUTFIT_MASK_REGION_COLORS[region];
      const overlay = maskCtx.createImageData(maskCanvas.width, maskCanvas.height);
      for (let i = 0; i < src.length; i += 4) {
        if (
          src[i + 3] > 0 &&
          Math.abs(src[i] - target.r) <= COLOR_MATCH_TOLERANCE &&
          Math.abs(src[i + 1] - target.g) <= COLOR_MATCH_TOLERANCE &&
          Math.abs(src[i + 2] - target.b) <= COLOR_MATCH_TOLERANCE
        ) {
          overlay.data[i] = tint.r;
          overlay.data[i + 1] = tint.g;
          overlay.data[i + 2] = tint.b;
          overlay.data[i + 3] = 255;
        }
      }
      const overlayCanvas = document.createElement("canvas");
      overlayCanvas.width = overlay.width;
      overlayCanvas.height = overlay.height;
      overlayCanvas.getContext("2d")!.putImageData(overlay, 0, 0);
      ctx.globalCompositeOperation = "multiply";
      ctx.drawImage(overlayCanvas, 0, 0);
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(base, 0, 0);
      ctx.globalCompositeOperation = "source-over";
    }
  }

  if (recolorCache.size > 400) recolorCache.clear();
  recolorCache.set(key, canvas);
  return canvas;
}

function drawAnchored(ctx: CanvasRenderingContext2D, image: CanvasImageSource & { width: number; height: number }, offsetX = 0, offsetY = 0) {
  ctx.drawImage(image, ANCHOR_X - image.width + offsetX, ANCHOR_Y - image.height + offsetY);
}

/** Camada 0 (e opcionalmente a camada 1 / "top aura", gravada como `mask` pelo pipeline do
 * `.obd`) de uma wings/aura, ou a imagem enviada. */
function drawExtraLayer(
  ctx: CanvasRenderingContext2D,
  layer: CompositeLayer,
  direction: number,
  ms: number,
  animate: boolean,
  withTopLayer: boolean,
) {
  if (layer.imageUrl) {
    const img = uploadedFrame(layer.imageUrl, ms, animate);
    if (img) drawAnchored(ctx, img, layer.offsetX, layer.offsetY);
    return;
  }
  if (!layer.looktype) return;
  const frame = cycleFrame(layer.looktype.frameCount, ms, animate);
  const base = looktypeLayer(layer.looktype, direction, 0, "base", frame);
  if (base) drawAnchored(ctx, base, layer.offsetX, layer.offsetY);
  if (withTopLayer && layer.looktype.hasColorMask) {
    const top = looktypeLayer(layer.looktype, direction, 0, "mask", frame);
    if (top) drawAnchored(ctx, top, layer.offsetX, layer.offsetY);
  }
}

function barImage(layer: CompositeLayer | null | undefined, ms: number, animate: boolean): Drawable | null {
  if (!layer) return null;
  if (layer.imageUrl) return uploadedFrame(layer.imageUrl, ms, animate);
  if (layer.looktype) return looktypeLayer(layer.looktype, 2, 0, "base", 0);
  return null;
}

/** Barra de vida/mana como no `Creature::drawInformation`: imagem decorativa centralizada sobre o
 * retângulo da barra, fundo preto e preenchimento de 2 px. */
function drawBar(ctx: CanvasRenderingContext2D, image: Drawable | null, layer: CompositeLayer | null | undefined, centerX: number, y: number, fill: string) {
  const size = image ? sizeOf(image) : null;
  const width = size ? Math.min(BAR_WIDTH, size.width - 2) : BAR_WIDTH;
  const x = Math.round(centerX - width / 2);
  if (image && size) {
    ctx.drawImage(
      image,
      Math.round(centerX - size.width / 2) + (layer?.offsetX ?? 0),
      Math.round(y + 2 - size.height / 2) + (layer?.offsetY ?? 0),
    );
  }
  ctx.fillStyle = "#000";
  ctx.fillRect(x, y, width, 4);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 1, y + 1, width - 2, 2);
}

/** Preview composto de outfit + extoutfits (aura, wings, shader, barras) na ordem de
 * `Outfit::draw` do OTClient (`cliente/src/client/outfit.cpp`). O shader roda de verdade via
 * WebGL (`OutfitShaderRenderer`). */
export function OutfitCompositePreview({
  outfit,
  direction,
  addons,
  colors,
  animate,
  zoom,
  wings,
  aura,
  shader,
  healthBar,
  manaBar,
  onShaderError,
}: OutfitCompositePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<OutfitShaderRenderer | null>(null);
  /** Programa compilado e linkado com sucesso — lido pelo loop de desenho. */
  const shaderReadyRef = useRef(false);
  const propsRef = useRef({ outfit, direction, addons, colors, animate, wings, aura, healthBar, manaBar });
  // O loop de `requestAnimationFrame` lê sempre as props mais recentes sem ser recriado.
  useEffect(() => {
    propsRef.current = { outfit, direction, addons, colors, animate, wings, aura, healthBar, manaBar };
  });

  // (Re)compila o shader quando o fonte muda.
  useEffect(() => {
    if (!shader?.fragment) {
      rendererRef.current?.dispose();
      rendererRef.current = null;
      shaderReadyRef.current = false;
      onShaderError?.(null);
      return;
    }
    let renderer: OutfitShaderRenderer;
    try {
      renderer = rendererRef.current ?? new OutfitShaderRenderer();
    } catch (error) {
      onShaderError?.((error as Error).message);
      return;
    }
    rendererRef.current = renderer;
    const error = renderer.setProgram(shader.fragment, shader.vertex);
    onShaderError?.(error);
    shaderReadyRef.current = !error;

    renderer.setTex1(null);
    if (shader.tex1Url) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => rendererRef.current?.setTex1(img);
      img.src = shader.tex1Url;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só recompila quando o fonte/textura muda
  }, [shader?.fragment, shader?.vertex, shader?.tex1Url]);

  useEffect(() => () => rendererRef.current?.dispose(), []);

  useEffect(() => {
    let raf = 0;
    const started = performance.now();

    function draw() {
      raf = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      const p = propsRef.current;
      const ms = performance.now() - started;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Grade do tile (referência de posição).
      ctx.strokeStyle = "rgba(127,127,127,0.35)";
      ctx.strokeRect(ANCHOR_X - 32 + 0.5, ANCHOR_Y - 32 + 0.5, 31, 31);

      // 1. Aura atrás (camadas 0 e 1), se não for `isFront`.
      if (p.aura && !p.aura.front) drawExtraLayer(ctx, p.aura, p.direction, ms, p.animate, true);
      // 2. Wings por baixo da outfit (exceto Norte).
      if (p.wings && p.direction !== 0) drawExtraLayer(ctx, p.wings, p.direction, ms, p.animate, false);

      // 3. Outfit (corpo + addons ligados), com shader quando houver.
      let outfitTop = ANCHOR_Y - 32;
      let outfitCenterX = ANCHOR_X - 16;
      if (p.outfit) {
        const frame = frameAt(p.outfit, ms, p.animate);
        const renderer = shaderReadyRef.current ? rendererRef.current : null;
        const shaderColors = (["head", "body", "legs", "feet"] as const).map(
          (region) => getOutfitPaletteColor(p.colors[region]) ?? { r: 255, g: 255, b: 255 },
        ) as [ShaderColor, ShaderColor, ShaderColor, ShaderColor];

        for (let slot = 0; slot <= p.outfit.addonSlots; slot++) {
          if (slot > 0 && !(p.addons & (1 << (slot - 1)))) continue;
          const base = looktypeLayer(p.outfit, p.direction, slot, "base", frame);
          if (!base) continue;
          const mask = p.outfit.hasColorMask ? looktypeLayer(p.outfit, p.direction, slot, "mask", frame) : null;
          if (slot === 0) {
            outfitTop = ANCHOR_Y - base.naturalHeight;
            outfitCenterX = ANCHOR_X - base.naturalWidth / 2;
          }
          const drawn = renderer ? renderer.render(base, mask, shaderColors) : recolored(base, mask, p.colors);
          drawAnchored(ctx, drawn);
        }
      }

      // 4. Aura na frente / wings por cima (Norte).
      if (p.aura && p.aura.front) drawExtraLayer(ctx, p.aura, p.direction, ms, p.animate, true);
      if (p.wings && p.direction === 0) drawExtraLayer(ctx, p.wings, p.direction, ms, p.animate, false);

      // 5. Barras acima da cabeça.
      if (p.healthBar || p.manaBar) {
        const barY = Math.max(6, outfitTop - 10);
        drawBar(ctx, barImage(p.healthBar, ms, p.animate), p.healthBar, outfitCenterX, barY, "#00c000");
        if (p.manaBar) drawBar(ctx, barImage(p.manaBar, ms, p.animate), p.manaBar, outfitCenterX, barY + 5, "#2060ff");
      }
    }

    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className="rounded-md border border-border bg-[repeating-conic-gradient(#80808022_0_25%,transparent_0_50%)] bg-[length:16px_16px]"
      style={{ width: CANVAS_WIDTH * zoom, height: CANVAS_HEIGHT * zoom, imageRendering: "pixelated" }}
    />
  );
}
