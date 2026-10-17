import { z } from "zod";

export const npcCategorySchema = z.object({
  name: z.string().min(1, "Informe um nome").max(100),
  description: z.string().max(255, "Máximo de 255 caracteres").optional().or(z.literal("")),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor hexadecimal, ex.: #7c3aed"),
});

export type NpcCategoryInput = z.infer<typeof npcCategorySchema>;

export const defaultNpcCategoryValues: NpcCategoryInput = {
  name: "",
  description: "",
  color: "#7c3aed",
};
