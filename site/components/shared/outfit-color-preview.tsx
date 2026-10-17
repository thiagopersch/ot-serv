"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImageOff } from "lucide-react";

import { looktypeOutfitLayerUrl } from "@/lib/looktype-storage";
import { OUTFIT_MASK_REGION_COLORS, getOutfitPaletteColor, type Rgb } from "@/lib/tibia-outfit-color";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const SIZE_CLASSES = { sm: "size-8", md: "size-16", lg: "size-24" } as const;
const SIZE_PX = { sm: 32, md: 64, lg: 96 } as const;

/** Tamanho máximo (px) do preview ampliado no tooltip — mesmos valores de `LooktypeAnimatedImage`/
 * `EntityThumb`. */
const MAX_PREVIEW_SIZE = 128;
const PREVIEW_SCALE = 3;

/** Tolerância de comparação de cor — os PNGs passam por compressão/composição antes de chegar
 * aqui, então o pixel da máscara pode não bater 100% com a cor plana original. */
const COLOR_MATCH_TOLERANCE = 40;

function colorMatches(r: number, g: number, b: number, target: Rgb): boolean {
  return (
    Math.abs(r - target.r) <= COLOR_MATCH_TOLERANCE &&
    Math.abs(g - target.g) <= COLOR_MATCH_TOLERANCE &&
    Math.abs(b - target.b) <= COLOR_MATCH_TOLERANCE
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

type OutfitColors = { head: number; body: number; legs: number; feet: number };

/** Desenha um slot (corpo base ou addon extra) sobre `ctx`, na posição (0,0) — a sprite base é
 * desenhada normal (`source-over`, empilha por cima do que já tiver no canvas) e, se o slot tiver
 * máscara de cor, cada uma das 4 regiões é recolorida via `multiply` com a paleta HSI do Tibia
 * (mesmo algoritmo/composição do `Creature::draw` do OTClient). */
async function drawOutfitSlot(
  ctx: CanvasRenderingContext2D,
  looktypeId: number,
  direction: number,
  slot: number,
  frameIndex: number,
  updatedDate: Date,
  hasColorMask: boolean,
  colors: OutfitColors,
): Promise<void> {
  const baseUrl = looktypeOutfitLayerUrl(looktypeId, direction, slot, "base", frameIndex, updatedDate);
  const baseImg = await loadImage(baseUrl);
  ctx.drawImage(baseImg, 0, 0);

  if (!hasColorMask) return;

  const maskUrl = looktypeOutfitLayerUrl(looktypeId, direction, slot, "mask", frameIndex, updatedDate);
  const maskImg = await loadImage(maskUrl);

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = maskImg.naturalWidth;
  maskCanvas.height = maskImg.naturalHeight;
  const maskCtx = maskCanvas.getContext("2d");
  if (!maskCtx) return;
  maskCtx.drawImage(maskImg, 0, 0);
  const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);

  const regions: { colorIndex: number; region: keyof typeof OUTFIT_MASK_REGION_COLORS }[] = [
    { colorIndex: colors.head, region: "head" },
    { colorIndex: colors.body, region: "body" },
    { colorIndex: colors.legs, region: "legs" },
    { colorIndex: colors.feet, region: "feet" },
  ];

  for (const { colorIndex, region } of regions) {
    const tint = getOutfitPaletteColor(colorIndex);
    if (!tint) continue;

    const regionColor = OUTFIT_MASK_REGION_COLORS[region];
    const overlay = maskCtx.createImageData(maskData.width, maskData.height);
    const src = maskData.data;
    const dst = overlay.data;

    for (let i = 0; i < src.length; i += 4) {
      const alpha = src[i + 3];
      if (alpha > 0 && colorMatches(src[i], src[i + 1], src[i + 2], regionColor)) {
        dst[i] = tint.r;
        dst[i + 1] = tint.g;
        dst[i + 2] = tint.b;
        dst[i + 3] = 255;
      }
    }

    const overlayCanvas = document.createElement("canvas");
    overlayCanvas.width = overlay.width;
    overlayCanvas.height = overlay.height;
    overlayCanvas.getContext("2d")?.putImageData(overlay, 0, 0);

    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(overlayCanvas, 0, 0);
    ctx.globalCompositeOperation = "source-over";
  }
}

type OutfitColorPreviewProps = {
  looktypeId: number;
  frameCount: number;
  frameDurationsMs: number[];
  updatedAt: string | Date;
  /** Nº de direções gravadas em disco (`Looktype.directions`) — 1 quando o outfit ainda não foi
   * reprocessado pelo pipeline com direção/máscara (mostra sempre a única disponível). */
  directions: number;
  hasColorMask: boolean;
  /** Nº de slots de addon extras gravados (`Looktype.addonSlots`) — 0 quando o outfit não tem
   * addon ou ainda não foi reprocessado. */
  addonSlots: number;
  /** 0=North, 1=East, 2=South, 3=West (mesma convenção do campo `direction` do NPC). */
  direction: number;
  /** Bitmask 0-3 do addon do outfit (0=nenhum, 1=addon1, 2=addon2, 3=os dois) — mesma convenção
   * do campo `lookAddons` do NPC/`Outfit::getAddons` do Tibia. */
  addons: number;
  headColor: number;
  bodyColor: number;
  legsColor: number;
  feetColor: number;
  size?: keyof typeof SIZE_CLASSES;
  /** Desliga o zoom no hover — ver mesmo motivo em `EntityThumb`/`LooktypeAnimatedImage`.
   * @default true */
  zoomOnHover?: boolean;
};

/** Preview do outfit com direção, addon e recoloração real (algoritmo HSI + máscara de região do
 * Tibia, ver `lib/tibia-outfit-color.ts`) — usado no formulário de NPC. Addons são camadas
 * ADITIVAS desenhadas por cima do corpo base (ex.: chapéu, mochila), não variantes alternativas —
 * por isso o slot 0 (base) é sempre desenhado primeiro, e os slots 1/2 só por cima quando o bit
 * correspondente do bitmask `addons` está ligado (mesmo comportamento do `Creature::draw` do
 * OTClient). Para o preview genérico (sem direção/cor/addon, usado em outros CRUDs) continue
 * usando `LooktypeAnimatedImage`. */
export function OutfitColorPreview({
  looktypeId,
  frameCount,
  frameDurationsMs,
  updatedAt,
  directions,
  hasColorMask,
  addonSlots,
  direction,
  addons,
  headColor,
  bodyColor,
  legsColor,
  feetColor,
  size = "md",
  zoomOnHover = true,
}: OutfitColorPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const sizeClass = SIZE_CLASSES[size];
  const sizePx = SIZE_PX[size];

  const updatedDate = useMemo(
    () => (typeof updatedAt === "string" ? new Date(updatedAt) : updatedAt),
    [updatedAt],
  );
  const effectiveDirection = directions > 1 ? direction : 0;
  const colors: OutfitColors = { head: headColor, body: bodyColor, legs: legsColor, feet: feetColor };

  useEffect(() => {
    if (frameCount <= 1) return;
    const duration = Math.min(frameDurationsMs[frameIndex] || 100, 1000);
    const timeout = setTimeout(() => setFrameIndex((current) => (current + 1) % frameCount), duration);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameIndex, frameCount]);

  useEffect(() => {
    if (frameCount <= 0) return;
    let cancelled = false;

    async function render() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      try {
        // Monta o frame inteiro (base + máscara + addons) num canvas fora da tela primeiro, e só
        // troca o canvas visível de uma vez no final — desenhar direto no canvas visível causava
        // um "piscar" a cada troca de frame, já que cada slot/máscara carrega de forma assíncrona
        // e o canvas ficava visível com o addon faltando por um instante entre um `await` e outro.
        const baseUrl = looktypeOutfitLayerUrl(looktypeId, effectiveDirection, 0, "base", frameIndex, updatedDate);
        const baseImg = await loadImage(baseUrl);
        if (cancelled) return;

        const offscreen = document.createElement("canvas");
        offscreen.width = baseImg.naturalWidth;
        offscreen.height = baseImg.naturalHeight;
        const offscreenCtx = offscreen.getContext("2d");
        if (!offscreenCtx) return;

        await drawOutfitSlot(offscreenCtx, looktypeId, effectiveDirection, 0, frameIndex, updatedDate, hasColorMask, colors);
        if (cancelled) return;

        // Slots 1/2 são aditivos (chapéu, mochila, ...) — só desenha quando o outfit realmente
        // tem esse slot gravado E o bit correspondente do addon do NPC está ligado.
        for (let slot = 1; slot <= addonSlots; slot++) {
          if (!(addons & (1 << (slot - 1)))) continue;
          await drawOutfitSlot(offscreenCtx, looktypeId, effectiveDirection, slot, frameIndex, updatedDate, hasColorMask, colors);
          if (cancelled) return;
        }

        canvas.width = offscreen.width;
        canvas.height = offscreen.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(offscreen, 0, 0);

        setNaturalSize({ width: canvas.width, height: canvas.height });
        setPreviewUrl(canvas.toDataURL());
      } catch {
        // Frame ainda não existe em disco (looktype não reprocessado) — deixa o canvas vazio.
      }
    }

    render();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    looktypeId,
    effectiveDirection,
    frameIndex,
    frameCount,
    hasColorMask,
    addonSlots,
    addons,
    headColor,
    bodyColor,
    legsColor,
    feetColor,
    updatedDate,
  ]);

  if (frameCount <= 0) {
    return (
      <span
        className={`${sizeClass} flex shrink-0 items-center justify-center rounded-sm border border-dashed border-border text-muted-foreground`}
      >
        <ImageOff className="size-3.5" />
      </span>
    );
  }

  const previewWidth = naturalSize ? Math.min(naturalSize.width * PREVIEW_SCALE, MAX_PREVIEW_SIZE) : undefined;
  const previewHeight = naturalSize ? Math.min(naturalSize.height * PREVIEW_SCALE, MAX_PREVIEW_SIZE) : undefined;

  const canvas = (
    <canvas
      ref={canvasRef}
      width={sizePx}
      height={sizePx}
      className={`${sizeClass} shrink-0 scale-100 rounded-sm border border-border bg-muted/40 transition-transform duration-150 ${zoomOnHover ? "hover:z-10 hover:scale-150" : ""}`}
      style={{ imageRendering: "pixelated" }}
    />
  );

  if (!zoomOnHover) return canvas;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex" />}>{canvas}</TooltipTrigger>
        <TooltipContent>
          <div className="mb-1 flex justify-center">
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- preview ampliado do mesmo canvas, via dataURL
              <img
                src={previewUrl}
                alt={`Looktype #${looktypeId}`}
                style={{
                  width: previewWidth ?? 64,
                  height: previewHeight ?? 64,
                  imageRendering: "pixelated",
                }}
                className="rounded-sm border border-border object-contain bg-muted/40"
              />
            )}
          </div>
          {`#${looktypeId}`}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
