"use client";

import { useEffect, useRef } from "react";
import useSWR from "swr";

import { looktypeFrameUrl, looktypeOutfitLayerUrl } from "@/lib/looktype-storage";
import { getOutfitPaletteColor } from "@/lib/tibia-outfit-color";
import { DEFAULT_PREVIEW_OUTFIT_COLORS } from "@/lib/extoutfit-preview-defaults";
import { OutfitShaderRenderer, type ShaderColor } from "@/lib/shader-preview/webgl-outfit-shader";
import type { ExtOutfitRow } from "@/lib/extoutfit-mapper";
import type { CompositeLooktype } from "@/components/shared/outfit-composite-preview";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const THUMB_PX = 64;
/** Preview ampliado no hover — mesmos valores de `LooktypeAnimatedImage` (2x, máx. 128px). */
const ZOOM_PX = 128;
const ZOOM_SCALE = 2;
const FRAME_INTERVAL_MS = 80;
const SOUTH = 2;

const textFetcher = (url: string) => fetch(url).then((response) => (response.ok ? response.text() : null));

// --- Imagens -----------------------------------------------------------------------------------

const imageCache = new Map<string, HTMLImageElement | "loading" | "error">();

function getImage(url: string): HTMLImageElement | null {
  const cached = imageCache.get(url);
  if (cached instanceof HTMLImageElement) return cached;
  if (cached) return null;
  imageCache.set(url, "loading");
  const img = new Image();
  img.onload = () => imageCache.set(url, img);
  img.onerror = () => imageCache.set(url, "error");
  img.src = url;
  return null;
}

/** Camada da outfit virada para o Sul (fallback: frame genérico quando não há camada por direção). */
function outfitLayer(outfit: CompositeLooktype, layer: "base" | "mask", frame: number): HTMLImageElement | null {
  const updated = new Date(outfit.updatedAt);
  const direction = outfit.directions > 1 ? SOUTH : 0;
  const layerUrl = looktypeOutfitLayerUrl(outfit.id, direction, 0, layer, frame, updated);
  const img = getImage(layerUrl);
  if (img || layer === "mask" || imageCache.get(layerUrl) !== "error") return img;
  return getImage(looktypeFrameUrl(outfit.id, frame, updated));
}

function frameAt(outfit: CompositeLooktype, ms: number): number {
  if (outfit.frameCount <= 1) return 0;
  const durations = Array.from({ length: outfit.frameCount }, (_, i) =>
    Math.max(50, Math.min(outfit.frameDurationsMs[i] || 100, 1000)),
  );
  let t = ms % durations.reduce((sum, d) => sum + d, 0);
  for (let i = 0; i < durations.length; i++) {
    if (t < durations[i]) return i;
    t -= durations[i];
  }
  return 0;
}

const COLORS = (["head", "body", "legs", "feet"] as const).map(
  (region) => getOutfitPaletteColor(DEFAULT_PREVIEW_OUTFIT_COLORS[region]) ?? { r: 255, g: 255, b: 255 },
) as [ShaderColor, ShaderColor, ShaderColor, ShaderColor];

// --- Agendador único: 1 contexto WebGL e 1 requestAnimationFrame para todas as miniaturas -------

type ThumbJob = {
  canvas: HTMLCanvasElement;
  visible: boolean;
  /** Tamanho do canvas (px) e se pode ampliar além de 1:1 (preview do tooltip). */
  sizePx: number;
  upscale: boolean;
  state: {
    outfit: CompositeLooktype | null;
    programKey: string;
    fragment: string | null;
    vertex: string | null;
    tex1Url: string | null;
  };
};

const jobs = new Set<ThumbJob>();
let sharedRenderer: OutfitShaderRenderer | null | undefined;
let rafId = 0;
let lastTick = 0;

function renderer(): OutfitShaderRenderer | null {
  if (sharedRenderer === undefined) {
    try {
      sharedRenderer = new OutfitShaderRenderer();
    } catch {
      sharedRenderer = null;
    }
  }
  return sharedRenderer;
}

function drawJob(job: ThumbJob, now: number) {
  const ctx = job.canvas.getContext("2d");
  const { outfit, fragment, vertex, programKey, tex1Url } = job.state;
  if (!ctx || !outfit) return;

  const frame = frameAt(outfit, now);
  const base = outfitLayer(outfit, "base", frame);
  if (!base) return;
  const mask = outfit.hasColorMask ? outfitLayer(outfit, "mask", frame) : null;

  let output: HTMLImageElement | HTMLCanvasElement = base;
  const shared = fragment ? renderer() : null;
  if (shared && fragment) {
    const error = shared.selectCachedProgram(programKey, fragment, vertex);
    if (error) {
      job.canvas.title = `Erro no shader: ${error}`;
    } else {
      shared.setTex1(tex1Url ? getImage(tex1Url) : null);
      output = shared.render(base, mask, COLORS);
    }
  }

  const size = job.sizePx;
  ctx.clearRect(0, 0, size, size);
  const fit = Math.min(size / output.width, size / output.height);
  // Miniatura: só reduz; preview ampliado: escala inteira (pixel art nítido), até caber no canvas.
  const scale = job.upscale ? (fit >= 1 ? Math.min(Math.floor(fit), ZOOM_SCALE) : fit) : Math.min(fit, 1);
  const width = Math.round(output.width * scale);
  const height = Math.round(output.height * scale);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(output, Math.round((size - width) / 2), Math.round((size - height) / 2), width, height);
}

function tick(now: number) {
  rafId = jobs.size > 0 ? requestAnimationFrame(tick) : 0;
  if (now - lastTick < FRAME_INTERVAL_MS) return;
  lastTick = now;
  for (const job of jobs) if (job.visible) drawJob(job, now);
}

function register(job: ThumbJob) {
  jobs.add(job);
  if (!rafId) rafId = requestAnimationFrame(tick);
}

function unregister(job: ThumbJob) {
  jobs.delete(job);
  if (jobs.size === 0 && rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
}

// --- Componentes -------------------------------------------------------------------------------

type ShaderCanvasProps = {
  row: ExtOutfitRow;
  outfit: CompositeLooktype | null;
  fragment: string | null;
  vertex: string | null;
  sizePx: number;
  upscale?: boolean;
  className: string;
};

/** Canvas 2D registrado no agendador compartilhado (desenha só enquanto visível). */
function ShaderCanvas({ row, outfit, fragment, vertex, sizePx, upscale = false, className }: ShaderCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const jobRef = useRef<ThumbJob | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const job: ThumbJob = {
      canvas,
      visible: true,
      sizePx,
      upscale,
      state: { outfit: null, programKey: "", fragment: null, vertex: null, tex1Url: null },
    };
    jobRef.current = job;
    register(job);

    const observer = new IntersectionObserver(([entry]) => {
      job.visible = entry.isIntersecting;
    });
    observer.observe(canvas);

    return () => {
      observer.disconnect();
      unregister(job);
      jobRef.current = null;
    };
  }, [sizePx, upscale]);

  useEffect(() => {
    if (!jobRef.current) return;
    jobRef.current.state = {
      outfit,
      programKey: `${row.id}:${row.updatedAt}`,
      fragment,
      vertex,
      tex1Url: row.shaderTex1Url,
    };
  }, [outfit, fragment, vertex, row.id, row.updatedAt, row.shaderTex1Url, sizePx, upscale]);

  return (
    <canvas
      ref={canvasRef}
      width={sizePx}
      height={sizePx}
      className={className}
      style={{ imageRendering: "pixelated" }}
    />
  );
}

/** Miniatura da listagem de shaders: a outfit padrão (`DEFAULT_PREVIEW_OUTFIT_LOOKTYPE_NUMBER`)
 * com o `.frag` do registro aplicado de verdade (WebGL compartilhado entre todas as linhas). Zoom
 * no hover igual a `LooktypeAnimatedImage`: escala 1.5x + tooltip com o preview ampliado. */
export function ShaderOutfitThumb({ row, outfit }: { row: ExtOutfitRow; outfit: (CompositeLooktype & { looktypeNumber?: number | null }) | null }) {
  const fileUrl = (part: string) => `/api/admin/extoutfits/${row.id}/file?part=${part}&inline=1&v=${row.updatedAt}`;
  const { data: fragment } = useSWR<string | null>(row.hasShaderSource ? fileUrl("fragment") : null, textFetcher, {
    revalidateOnFocus: false,
  });
  const { data: vertex } = useSWR<string | null>(row.hasShaderVertex ? fileUrl("vertex") : null, textFetcher, {
    revalidateOnFocus: false,
  });

  const shared = { row, outfit, fragment: fragment ?? null, vertex: vertex ?? null };
  const caption = row.hasShaderSource
    ? `${row.shaderName}${outfit?.looktypeNumber != null ? ` — outfit nº ${outfit.looktypeNumber}` : ""}`
    : `${row.shaderName} — sem .frag (outfit sem efeito)`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex" />}>
          <ShaderCanvas
            {...shared}
            sizePx={THUMB_PX}
            className="size-10 shrink-0 scale-100 rounded-sm border border-border bg-muted/40 transition-transform duration-150 hover:z-10 hover:scale-150"
          />
        </TooltipTrigger>
        <TooltipContent>
          <div className="mb-1 flex justify-center">
            <ShaderCanvas
              {...shared}
              sizePx={ZOOM_PX}
              upscale
              className="size-32 rounded-sm border border-border bg-muted/40"
            />
          </div>
          {caption}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}