"use client";

import { DEFAULT_PREVIEW_OUTFIT_LOOKTYPE_NUMBER } from "@/lib/extoutfit-preview-defaults";
import {
  useOutfitLooktypeByNumber,
  type OutfitLooktypeRow,
} from "@/components/shared/use-outfit-looktype-by-number";

export type PreviewOutfitRow = OutfitLooktypeRow;

/** Looktype de outfit padrão dos previews (`DEFAULT_PREVIEW_OUTFIT_LOOKTYPE_NUMBER`), buscada no
 * cadastro de looktypes. `null` enquanto carrega ou se não existir. */
export function useDefaultPreviewOutfit(): PreviewOutfitRow | null {
  return useOutfitLooktypeByNumber(DEFAULT_PREVIEW_OUTFIT_LOOKTYPE_NUMBER) ?? null;
}
