import { z } from "zod";

export const spriteSettingsFormSchema = z.object({
  hdSprites: z.boolean(),
});
export type SpriteSettingsFormInput = z.infer<typeof spriteSettingsFormSchema>;
