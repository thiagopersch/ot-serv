"use client";

import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import { HD_SPRITES_SETTINGS_URL, spriteScale } from "@/lib/sprite-hd";

/** Flag de HD Mode das sprites (`/admin/settings`). `hd` fica `undefined` só até a 1ª resposta —
 * os componentes de sprite esperam esse valor antes de montar a URL, pra não baixar a sprite 1x
 * e logo depois a 2x. Se a request falhar, cai no modo normal. */
export function useHdSprites(): { hd: boolean | undefined; scale: number } {
  const { data, error } = useSWR<{ hdSprites: boolean }>(HD_SPRITES_SETTINGS_URL, fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 60_000,
  });
  const hd = data ? data.hdSprites : error ? false : undefined;
  return { hd, scale: spriteScale(hd) };
}
