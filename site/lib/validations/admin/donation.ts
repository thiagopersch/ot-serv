import { z } from "zod";

export const donationSchema = z.object({
  accountName: z.string().min(1, "Informe a conta").max(255),
  amount: z.number().min(0, "Informe um valor válido"),
  note: z.string().max(255).optional(),
});

export type DonationInput = z.infer<typeof donationSchema>;
