"use client";

import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import { EntityThumb } from "@/components/shared/entity-thumb";
import { Skeleton } from "@/components/ui/skeleton";

const SIZE_CLASSES = { sm: "size-6", "32": "size-8", md: "size-10", lg: "size-16" } as const;

/** Resolve o id do item pelo nome exato (para tabelas que só guardam o nome, ex.: `lottery.item`)
 * pra poder mostrar a imagem (`EntityThumb`) vinculada no cadastro de items. Mesmo padrão de
 * `MonsterThumbByName`. */
export function ItemThumbByName({ name, size = "sm" }: { name: string; size?: "sm" | "32" | "md" | "lg" }) {
  const { data, isLoading } = useSWR<PaginatedResult<{ id: number; name: string }>>(
    name ? `/api/admin/items?search=${encodeURIComponent(name)}&pageSize=5` : null,
    fetcher,
  );

  if (name && isLoading) {
    return <Skeleton className={`${SIZE_CLASSES[size]} rounded-md`} />;
  }

  const item = data?.data.find((row) => row.name.toLowerCase() === name.toLowerCase());
  if (!item) return null;

  return <EntityThumb entityType="item" id={item.id} name={item.name} size={size} />;
}
