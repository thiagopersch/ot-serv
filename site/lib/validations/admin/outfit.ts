import { z } from "zod";

/** Cadastro de uma `<outfit>` do `outfits.xml` — compartilhado entre o form e a API. */
export const outfitSchema = z.object({
  id: z.number().int().min(1, "Informe o id da outfit"),
  name: z.string().trim().min(1, "Informe um nome").max(100),
  type: z.number().int().min(0),
  premium: z.boolean(),
  storageId: z.string().trim().max(20),
  storageValue: z.string().trim().max(20),
  maleLooktypeId: z.number().int().min(1, "Selecione a looktype masculina"),
  femaleLooktypeId: z.number().int().min(1, "Selecione a looktype feminina"),
  /** 0 = nenhum item libera essa outfit. */
  unlockItemId: z.number().int().min(0),
});

export type OutfitInput = z.infer<typeof outfitSchema>;

export const defaultOutfitValues: OutfitInput = {
  id: 0,
  name: "",
  type: 0,
  premium: false,
  storageId: "",
  storageValue: "",
  maleLooktypeId: 0,
  femaleLooktypeId: 0,
  unlockItemId: 0,
};
