"use client";

import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import type { CompositeLooktype } from "@/components/shared/outfit-composite-preview";

export type OutfitLooktypeRow = CompositeLooktype & { name: string; looktypeNumber: number | null };

/** Resolve o número da looktype no cliente (ex.: `CustomOutfit.lookType`, `DEFAULT_PREVIEW_OUTFIT_
 * LOOKTYPE_NUMBER`) para o registro do cadastro de looktypes (category="outfit"). Duplicatas
 * legadas de número resolvem para o menor id (mesma regra de `findOutfitLooktypeByNumber`).
 * `undefined` enquanto carrega; `null` se o número for inválido ou não houver cadastro. */
export function useOutfitLooktypeByNumber(
  looktypeNumber: number | null | undefined,
): OutfitLooktypeRow | null | undefined {
  const valid = typeof looktypeNumber === "number" && looktypeNumber > 0;
  const { data } = useSWR<PaginatedResult<OutfitLooktypeRow>>(
    valid ? `/api/admin/looktypes?category=outfit&search=${looktypeNumber}&pageSize=50&skipCount=1` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  if (!valid) return null;
  if (!data) return undefined;
  const matches = (data?.data ?? []).filter((row) => row.looktypeNumber === looktypeNumber);
  return matches.reduce<OutfitLooktypeRow | null>((best, row) => (!best || row.id < best.id ? row : best), null);
}
