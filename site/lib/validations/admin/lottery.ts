import { z } from "zod";

export const lotterySchema = z.object({
  name: z.string().min(1).max(255),
  item: z.string().min(1).max(255),
});

export type LotteryInput = z.infer<typeof lotterySchema>;
