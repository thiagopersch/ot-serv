import { z } from "zod";

export const accountUpdateSchema = z.object({
  name: z.string().min(1, "Informe o nome da conta").max(255),
  // Vazio = não altera a senha atual.
  password: z.string().max(255).optional().or(z.literal("")),
  email: z.union([z.email("E-mail inválido"), z.literal("")]),
  premdays: z.number().int().min(0),
  warnings: z.number().int().min(0),
  blocked: z.boolean(),
  groupId: z.number().int().min(1).max(6),
});

export type AccountUpdateInput = z.infer<typeof accountUpdateSchema>;
