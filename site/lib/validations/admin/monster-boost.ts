import { z } from "zod";

export const monsterBoostSchema = z.object({
  monster: z.string().min(1).max(255),
  loot: z.number().int(),
  exp: z.number().int(),
});

export type MonsterBoostInput = z.infer<typeof monsterBoostSchema>;
