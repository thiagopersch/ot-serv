import { z } from "zod";

/** Storage do jogador que libera o outfit customizado `id` (= `CustomOutfits.STORAGE_BASE + id`
 * em `server/data/lib/custom_outfits.lua`). */
export const CUSTOM_OUTFIT_STORAGE_BASE = 61000;
/** Id do outfit no `outfits.xml` (acima dos ids de saga, que vão até ~660). */
export const CUSTOM_OUTFIT_XML_ID_BASE = 1000;

export const customOutfitSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome.").max(60),
  lookType: z.number().int().positive("Informe o looktype."),
  itemId: z.number().int().positive("Escolha o item que libera o outfit."),
  clientId: z.number().int().min(0),
  active: z.boolean(),
});

export type CustomOutfitInput = z.infer<typeof customOutfitSchema>;

export const defaultCustomOutfitValues: CustomOutfitInput = {
  name: "",
  lookType: 0,
  itemId: 0,
  clientId: 0,
  active: true,
};
