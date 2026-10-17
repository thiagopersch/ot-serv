"use client";

import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import { MonsterThumb } from "@/components/shared/monster-thumb";
import { Skeleton } from "@/components/ui/skeleton";

/** `TaskDefinition.monsters` guarda só o nome do monstro (JSON), sem id — resolve o id via
 * busca exata pra poder mostrar a sprite (`MonsterThumb`, cadastro de monstros) no formulário. */
export function MonsterThumbByName({
  name,
  size = "32",
  zoomOnHover = true,
}: {
  name: string;
  size?: "32" | "sm" | "md" | "lg";
  zoomOnHover?: boolean;
}) {
  const { data, isLoading } = useSWR<PaginatedResult<{ id: number; name: string; lookTypeId: number | null }>>(
    name ? `/api/admin/monsters?search=${encodeURIComponent(name)}&pageSize=5` : null,
    fetcher,
  );

  if (name && isLoading) {
    return <Skeleton className="size-8 rounded-md" />;
  }

  const monster = data?.data.find((row) => row.name.toLowerCase() === name.toLowerCase());
  if (!monster) return null;

  return (
    <MonsterThumb id={monster.id} name={monster.name} lookTypeId={monster.lookTypeId} size={size} zoomOnHover={zoomOnHover} />
  );
}
