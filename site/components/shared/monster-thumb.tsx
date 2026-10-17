"use client";

import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import { LooktypeAnimatedImage } from "@/components/shared/looktype-animated-image";
import { EntityThumb } from "@/components/shared/entity-thumb";
import { Skeleton } from "@/components/ui/skeleton";

type LooktypeRow = { id: number; frameCount: number; frameDurationsMs: number[]; updatedAt: string };

type MonsterThumbProps = {
  id: number;
  name?: string;
  /** `Monster.lookTypeId` — quando presente, mostra a sprite animada (cadastro de looktypes)
   * em vez da imagem estática antiga (`EntityThumb`). */
  lookTypeId?: number | null;
  size?: "sm" | "32" | "md" | "lg";
  /** Desliga o zoom no hover — ver mesmo motivo em `EntityThumb`. @default true */
  zoomOnHover?: boolean;
};

/** Sprite de monstro — anima via looktype vinculada (`lookTypeId`) quando disponível, com
 * fallback pra imagem estática (`EntityThumb`) em monstros ainda sem sprite vinculada. */
export function MonsterThumb({ id, name, lookTypeId, size = "sm", zoomOnHover = true }: MonsterThumbProps) {
  const { data, isLoading } = useSWR<PaginatedResult<LooktypeRow>>(
    lookTypeId ? `/api/admin/looktypes?search=${lookTypeId}&pageSize=5` : null,
    fetcher,
  );

  if (lookTypeId && isLoading) {
    return <Skeleton className="size-8 rounded-md" />;
  }

  const looktype = data?.data.find((row) => row.id === lookTypeId);
  if (looktype) {
    return (
      <LooktypeAnimatedImage
        key={looktype.id}
        looktypeId={looktype.id}
        frameCount={looktype.frameCount}
        frameDurationsMs={looktype.frameDurationsMs}
        updatedAt={looktype.updatedAt}
        size={size === "32" ? "sm" : size}
        zoomOnHover={zoomOnHover}
      />
    );
  }

  return <EntityThumb entityType="monster" id={id} name={name} size={size} zoomOnHover={zoomOnHover} />;
}
