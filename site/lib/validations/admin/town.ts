import { z } from "zod";

export const townFormSchema = z.object({
  id: z.number().int().min(0, "Informe o id"),
  name: z.string().min(1, "Informe o nome").max(100),
  templeX: z.number().int(),
  templeY: z.number().int(),
  templeZ: z.number().int(),
  published: z.boolean(),
});
export type TownFormInput = z.infer<typeof townFormSchema>;

export const defaultTownValues: TownFormInput = {
  id: 0,
  name: "",
  templeX: 0,
  templeY: 0,
  templeZ: 7,
  published: true,
};
