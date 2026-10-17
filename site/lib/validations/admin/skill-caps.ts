import { z } from "zod";

export const skillCapsFormSchema = z.object({
  dodgeCap: z.number().int().min(1, "Informe um valor maior que zero"),
  criticalCap: z.number().int().min(1, "Informe um valor maior que zero"),
});
export type SkillCapsFormInput = z.infer<typeof skillCapsFormSchema>;
