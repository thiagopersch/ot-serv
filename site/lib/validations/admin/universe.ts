import { z } from "zod";

export const universeSchema = z.object({
  name: z.string().min(1, "Informe um nome").max(100),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Informe uma cor hexadecimal válida (#rrggbb)")
    .nullable(),
});

export type UniverseInput = z.infer<typeof universeSchema>;
