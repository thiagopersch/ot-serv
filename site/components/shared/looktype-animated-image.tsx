"use client";

import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";

import { looktypeFrameUrl } from "@/lib/looktype-storage";
import { spriteUrlScale } from "@/lib/sprite-hd";
import { useHdSprites } from "@/hooks/use-hd-sprites";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const SIZE_CLASSES = { sm: "size-8", md: "size-16", lg: "size-24" } as const;

/** Tamanho máximo (px) do preview ampliado no tooltip — mesmos valores de `EntityThumb`. */
const MAX_PREVIEW_SIZE = 128;
const PREVIEW_SCALE = 2;

type LooktypeAnimatedImageProps = {
  looktypeId: number;
  frameCount: number;
  frameDurationsMs: number[];
  updatedAt: string | Date;
  size?: keyof typeof SIZE_CLASSES;
  /** Desliga o zoom no hover — ver mesmo motivo em `EntityThumb`. @default true */
  zoomOnHover?: boolean;
};

/** Cicla os frames pré-renderizados (`renderLooktypeFrames`/`renderRasterFrames`, salvos como
 * PNG em disco no upload) usando a duração real de cada frame — sempre limitada a 1s por quadro
 * (`MAX_FRAME_DURATION_MS` em `lib/obd/obd-render.ts`), não importa o formato de origem
 * (.obd, .png, .gif).
 * Passe `key={looktypeId}` no caller se a mesma instância puder trocar de looktype (ex.:
 * dentro de um dialog reaproveitado) — sem isso o índice de frame não reseta ao trocar.
 * Zoom no hover segue o mesmo padrão de `EntityThumb` (scale inline + preview ampliado no
 * tooltip, com o frame atual do ciclo). */
export function LooktypeAnimatedImage({
  looktypeId,
  frameCount,
  frameDurationsMs,
  updatedAt,
  size = "md",
  zoomOnHover = true,
}: LooktypeAnimatedImageProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const sizeClass = SIZE_CLASSES[size];
  const { hd } = useHdSprites();

  useEffect(() => {
    if (frameCount <= 1) return;

    const duration = Math.min(frameDurationsMs[frameIndex] || 100, 1000);
    const timeout = setTimeout(() => {
      setFrameIndex((current) => (current + 1) % frameCount);
    }, duration);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameIndex, frameCount]);

  if (frameCount > 0 && hd === undefined) {
    return <span className={`${sizeClass} shrink-0 rounded-sm border border-border bg-muted/40`} />;
  }

  if (frameCount <= 0) {
    return (
      <span
        className={`${sizeClass} flex shrink-0 items-center justify-center rounded-sm border border-dashed border-border text-muted-foreground`}
      >
        <ImageOff className="size-3.5" />
      </span>
    );
  }

  const updatedDate = typeof updatedAt === "string" ? new Date(updatedAt) : updatedAt;
  const frameUrl = looktypeFrameUrl(looktypeId, frameIndex, updatedDate, hd);
  // Sprite HD tem 2x os pixels — o preview usa o tamanho lógico (32px) pra não dobrar de tamanho.
  const scale = spriteUrlScale(frameUrl);
  const imageRendering = scale > 1 ? "auto" : "pixelated";

  const previewWidth = naturalSize ? Math.min((naturalSize.width / scale) * PREVIEW_SCALE, MAX_PREVIEW_SIZE) : undefined;
  const previewHeight = naturalSize ? Math.min((naturalSize.height / scale) * PREVIEW_SCALE, MAX_PREVIEW_SIZE) : undefined;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex" />}>
          {/* eslint-disable-next-line @next/next/no-img-element -- sprite pequeno gerado localmente, ciclando frames via troca de src */}
          <img
            src={frameUrl}
            alt={`Looktype #${looktypeId}`}
            onLoad={(event) => {
              const { naturalWidth, naturalHeight } = event.currentTarget;
              setNaturalSize({ width: naturalWidth, height: naturalHeight });
            }}
            className={`${sizeClass} shrink-0 scale-100 rounded-sm border border-border object-contain bg-muted/40 transition-transform duration-150 ${zoomOnHover ? "hover:z-10 hover:scale-150" : ""}`}
            style={{ imageRendering }}
          />
        </TooltipTrigger>
        <TooltipContent>
          <div className="mb-1 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- preview ampliado do mesmo sprite, já em cache do browser */}
            <img
              src={frameUrl}
              alt={`Looktype #${looktypeId}`}
              style={{
                width: previewWidth ?? 64,
                height: previewHeight ?? 64,
                imageRendering,
              }}
              className="rounded-sm border border-border object-contain bg-muted/40"
            />
          </div>
          {`#${looktypeId}`}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
