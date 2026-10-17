import { z } from "zod";

/** Raridades do pool diário — mesma lista de `DailyReward.RARITIES` em
 * `server/data/lib/daily_reward.lua` (o servidor ignora raridades desconhecidas). */
export const DAILY_REWARD_RARITIES = ["comum", "incomum", "raro", "lendario", "mitico"] as const;
export type DailyRewardRarity = (typeof DAILY_REWARD_RARITIES)[number];

export const DAILY_REWARD_RARITY_LABELS: Record<DailyRewardRarity, string> = {
  comum: "Comum",
  incomum: "Incomum",
  raro: "Raro",
  lendario: "Lendário",
  mitico: "Mítico",
};

export const DEFAULT_DAILY_REWARD_RARITY_WEIGHTS: Record<DailyRewardRarity, number> = {
  comum: 50,
  incomum: 25,
  raro: 15,
  lendario: 7,
  mitico: 3,
};

/** Item do pool padrão (sem dia — o dia é sorteado na geração do mês). */
export const dailyRewardPoolItemSchema = z.object({
  itemId: z.number().int().positive(),
  clientId: z.number().int().min(0),
  count: z.number().int().min(1),
});
export type DailyRewardPoolItemInput = z.infer<typeof dailyRewardPoolItemSchema>;

const rarityWeightSchema = z.number().int().min(0).max(1000);
const rarityItemsSchema = z.array(dailyRewardPoolItemSchema);

export const dailyRewardDefaultSchema = z
  .object({
    weights: z.object({
      comum: rarityWeightSchema,
      incomum: rarityWeightSchema,
      raro: rarityWeightSchema,
      lendario: rarityWeightSchema,
      mitico: rarityWeightSchema,
    }),
    daily: z.object({
      comum: rarityItemsSchema,
      incomum: rarityItemsSchema,
      raro: rarityItemsSchema,
      lendario: rarityItemsSchema,
      mitico: rarityItemsSchema,
    }),
    bonus: z.array(dailyRewardPoolItemSchema),
    /** Ids de `custom_outfits` cujo item é sorteado ao resgatar um bonus. */
    customOutfitIds: z.array(z.number().int().positive()),
  })
  .superRefine((data, ctx) => {
    const usable = DAILY_REWARD_RARITIES.filter(
      (rarity) => data.daily[rarity].length > 0 && data.weights[rarity] > 0,
    );
    if (usable.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cadastre ao menos um item em uma raridade com peso maior que 0.",
        path: ["daily"],
      });
    }
  });

export type DailyRewardDefaultInput = z.infer<typeof dailyRewardDefaultSchema>;

export const emptyDailyRewardDefaultValues: DailyRewardDefaultInput = {
  weights: { ...DEFAULT_DAILY_REWARD_RARITY_WEIGHTS },
  daily: { comum: [], incomum: [], raro: [], lendario: [], mitico: [] },
  bonus: [],
  customOutfitIds: [],
};
