"use client";

import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import { OutfitColorPreview } from "@/components/shared/outfit-color-preview";
import { Skeleton } from "@/components/ui/skeleton";

type LooktypeRow = {
  id: number;
  frameCount: number;
  frameDurationsMs: number[];
  updatedAt: string;
  directions: number;
  hasColorMask: boolean;
  addonSlots: number;
};

const SIZE_CLASSES = { sm: "size-8", md: "size-16", lg: "size-24" } as const;

/** Como `LooktypeThumbById`, mas pra entidades que têm sua própria direção/cor/addon (ex.: NPC)
 * — resolve a looktype pelo id (mesmo padrão de fetch, sem rota GET por id) e renderiza via
 * `OutfitColorPreview` (direção real + recoloração HSI + addons aditivos) em vez do
 * `LooktypeAnimatedImage` genérico (sempre Sul, sem cor). */
export function OutfitColorThumbById({
  looktypeId,
  direction,
  addons,
  headColor,
  bodyColor,
  legsColor,
  feetColor,
  size = "sm",
}: {
  looktypeId: number;
  direction: number;
  addons: number;
  headColor: number;
  bodyColor: number;
  legsColor: number;
  feetColor: number;
  size?: "sm" | "md" | "lg";
}) {
  const { data, isLoading } = useSWR<PaginatedResult<LooktypeRow>>(
    looktypeId > 0 ? `/api/admin/looktypes?search=${looktypeId}&pageSize=5` : null,
    fetcher,
  );

  if (looktypeId > 0 && isLoading) {
    return <Skeleton className={`${SIZE_CLASSES[size]} rounded-md`} />;
  }

  const looktype = data?.data.find((row) => row.id === looktypeId);
  if (!looktype) return null;

  return (
    <OutfitColorPreview
      key={looktype.id}
      looktypeId={looktype.id}
      frameCount={looktype.frameCount}
      frameDurationsMs={looktype.frameDurationsMs}
      updatedAt={looktype.updatedAt}
      directions={looktype.directions}
      hasColorMask={looktype.hasColorMask}
      addonSlots={looktype.addonSlots}
      direction={direction}
      addons={addons}
      headColor={headColor}
      bodyColor={bodyColor}
      legsColor={legsColor}
      feetColor={feetColor}
      size={size}
    />
  );
}
