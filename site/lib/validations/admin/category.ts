import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(1, "Informe um nome").max(50),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor hexadecimal, ex.: #7c3aed"),
});

export type CategoryInput = z.infer<typeof categorySchema>;

export const defaultCategoryValues: CategoryInput = {
  name: "",
  color: "#7c3aed",
};
