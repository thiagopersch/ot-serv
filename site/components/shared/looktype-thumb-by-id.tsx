"use client";

import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import { LooktypeAnimatedImage } from "@/components/shared/looktype-animated-image";
import { Skeleton } from "@/components/ui/skeleton";

type LooktypeRow = {
  id: number;
  frameCount: number;
  frameDurationsMs: number[];
  updatedAt: string;
};

const SIZE_CLASSES = { sm: "size-8", md: "size-16", lg: "size-24" } as const;

/** Resolve a looktype pelo id (não há rota GET por id, só a listagem paginada) pra mostrar o
 * preview animado onde só o `lookTypeId`/`lookType` numérico é guardado (ex.: `npcs.look_type_id`,
 * `task_definitions.look_type`). Mesmo padrão de `MonsterThumbByName`/`ItemThumbByName`. */
export function LooktypeThumbById({ looktypeId, size = "sm" }: { looktypeId: number; size?: "sm" | "md" | "lg" }) {
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
    <LooktypeAnimatedImage
      key={looktype.id}
      looktypeId={looktype.id}
      frameCount={looktype.frameCount}
      frameDurationsMs={looktype.frameDurationsMs}
      updatedAt={looktype.updatedAt}
      size={size}
    />
  );
}
