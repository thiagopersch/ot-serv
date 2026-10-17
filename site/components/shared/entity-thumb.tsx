"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { ImageOff } from "lucide-react";

import { entityImageUrl, type EntityImageType } from "@/lib/entity-image";
import { fetchEntityImageBatched } from "@/lib/entity-image-batch";
import { looktypeFrameUrl } from "@/lib/looktype-storage";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { EntityImageInfo } from "@/components/shared/use-entity-images";

const SIZE_CLASSES = { sm: "size-6", "32": "size-8", md: "size-10", lg: "size-16" } as const;

/** Tamanho máximo (px) do preview ampliado no tooltip, mesmo que a imagem original seja
 * grande — evita um preview gigante para uma imagem custom fora do padrão de sprite. */
const MAX_PREVIEW_SIZE = 128;
/** Fator de ampliação do preview em relação ao tamanho natural do arquivo (ex.: 32x32 vira
 * 64x64), até o teto de `MAX_PREVIEW_SIZE`. */
const PREVIEW_SCALE = 3;

type EntityThumbProps = {
  entityType: EntityImageType;
  id: number;
  name?: string;
  size?: keyof typeof SIZE_CLASSES;
  /** Já resolvido pelo caller (ex.: tabela usando `useEntityImages` em lote). Quando omitido,
   * o componente busca sozinho (lookup individual — barato, usado em campos avulsos). */
  image?: EntityImageInfo | null;
  /** Desliga o zoom no hover — necessário em contextos onde a sprite fica sobre botões de ação
   * (ex.: cards de loot com editar/duplicar/remover no canto), já que o `scale-150` aumenta o
   * elemento por cima dos botões e captura o clique antes deles. @default true */
  zoomOnHover?: boolean;
};

/** Chave estável por entidade (não pela URL) — várias instâncias de `EntityThumb` para o mesmo
 * id dedupem pelo cache do SWR, e o fetch de rede em si é coalescido entre ids diferentes por
 * `fetchEntityImageBatched` (uma request pra N thumbs que montam juntas, em vez de N requests). */
function useOwnLookup(entityType: EntityImageType, id: number, skip: boolean) {
  const key = skip || !Number.isFinite(id) || id <= 0 ? null : (["entity-image", entityType, id] as const);
  const { data } = useSWR(key, ([, type, entityId]) => fetchEntityImageBatched(type, entityId));
  return data ?? null;
}

export function EntityThumb({
  entityType,
  id,
  name,
  size = "sm",
  image,
  zoomOnHover = true,
}: EntityThumbProps) {
  const resolvedByProp = image !== undefined;
  const owned = useOwnLookup(entityType, id, resolvedByProp);
  const info = resolvedByProp ? image : owned;
  const looktype = info?.looktype ?? null;

  const [naturalSize, setNaturalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);

  // Sprite vinculada ao cadastro de looktypes tem prioridade sobre o snapshot estático
  // (`EntityImage`) — cicla os frames em vez de mostrar só o frame 0 congelado. Reset do
  // índice ao trocar de looktype ajustado durante o render (não num efeito em separado),
  // seguindo o padrão recomendado pra "resetar estado quando uma prop muda".
  const [lastLooktypeId, setLastLooktypeId] = useState(looktype?.id);
  if (looktype?.id !== lastLooktypeId) {
    setLastLooktypeId(looktype?.id);
    setFrameIndex(0);
  }

  useEffect(() => {
    if (!looktype || looktype.frameCount <= 1) return;

    const duration = looktype.frameDurationsMs[frameIndex] || 100;
    const timeout = setTimeout(() => {
      setFrameIndex((current) => (current + 1) % looktype.frameCount);
    }, duration);
    return () => clearTimeout(timeout);
  }, [looktype, frameIndex]);

  const sizeClass = SIZE_CLASSES[size];
  const label = name ? `#${id} — ${name}` : `#${id}`;
  const tooltipLabel = name ? `${name} (#${id})` : `#${id}`;

  const imageUrl = looktype
    ? looktypeFrameUrl(looktype.id, frameIndex, new Date(looktype.updatedAt))
    : info?.extension && info?.updatedAt
      ? entityImageUrl(entityType, id, info.extension, new Date(info.updatedAt))
      : null;

  const previewWidth = naturalSize
    ? Math.min(naturalSize.width * PREVIEW_SCALE, MAX_PREVIEW_SIZE)
    : undefined;
  const previewHeight = naturalSize
    ? Math.min(naturalSize.height * PREVIEW_SCALE, MAX_PREVIEW_SIZE)
    : undefined;

  const content = imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- sprite pequeno, servido estático de public/storage, sem necessidade de otimização do next/image
    <img
      src={imageUrl}
      alt={label}
      onLoad={(event) => {
        const { naturalWidth, naturalHeight } = event.currentTarget;
        setNaturalSize({ width: naturalWidth, height: naturalHeight });
      }}
      className={`${sizeClass} shrink-0 scale-100 rounded-sm border border-border object-contain bg-muted/40 transition-transform duration-150 ${zoomOnHover ? "hover:z-10 hover:scale-150" : ""}`}
    />
  ) : (
    <span
      className={`${sizeClass} flex shrink-0 scale-100 items-center justify-center rounded-sm border border-dashed border-border text-muted-foreground transition-transform duration-150 ${zoomOnHover ? "hover:z-10 hover:scale-150" : ""}`}
    >
      <ImageOff className="size-3.5" />
    </span>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex" />}>
          {content}
        </TooltipTrigger>
        <TooltipContent>
          {imageUrl && (
            <div className="mb-1 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- preview ampliado do mesmo sprite, já em cache do browser */}
              <img
                src={imageUrl}
                alt={label}
                style={{
                  width: previewWidth ?? 64,
                  height: previewHeight ?? 64,
                  imageRendering: "pixelated",
                }}
                className="rounded-sm border border-border object-contain bg-muted/40"
              />
            </div>
          )}
          {tooltipLabel}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
