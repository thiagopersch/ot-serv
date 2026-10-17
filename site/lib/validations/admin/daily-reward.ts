import { z } from "zod";

import { daysInMonth } from "@/lib/daily-reward-competencia";

/** Recompensa de um dia específico do mês (tabela `daily_rewards_monthly`). */
export const dailyRewardEntrySchema = z.object({
  day: z.number().int().min(1).max(31),
  itemId: z.number().int().positive(),
  /// Id do sprite no cliente (.dat/.otb) — o servidor lê esse valor direto da coluna
  /// `client_id`, sem resolver a partir de `itemId` em tempo de execução (ver
  /// `data/lib/daily_reward.lua: DailyReward.getMonthCache`), então precisa ser preenchido
  /// corretamente aqui (o seletor de item preenche a partir de `items.client_id`).
  clientId: z.number().int().min(0),
  count: z.number().int().min(1),
});
export type DailyRewardEntryInput = z.infer<typeof dailyRewardEntrySchema>;

/** Recompensa bonus por sequência de dias consecutivos (tabela `daily_rewards_bonus_monthly`) —
 * o servidor exibe os marcos cadastrados aqui, na ordem de `streakDay` (padrão gerado:
 * 5/10/15/20/25/30, com o último no dia 28 em fevereiro — `bonusMilestones`). O portal limita o
 * cadastro a `MAX_DAILY_REWARD_BONUS_ENTRIES`, o tamanho da janela do cliente. */
export const dailyRewardBonusEntrySchema = z.object({
  streakDay: z.number().int().min(1).max(31),
  itemId: z.number().int().positive(),
  clientId: z.number().int().min(0),
  count: z.number().int().min(1),
});
export type DailyRewardBonusEntryInput = z.infer<typeof dailyRewardBonusEntrySchema>;

export const MAX_DAILY_REWARD_BONUS_ENTRIES = 6;

export const dailyRewardCompetenciaSchema = z
  .object({
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2000).max(2100),
    rewards: z.array(dailyRewardEntrySchema),
    bonusRewards: z
      .array(dailyRewardBonusEntrySchema)
      .max(MAX_DAILY_REWARD_BONUS_ENTRIES, `No máximo ${MAX_DAILY_REWARD_BONUS_ENTRIES} recompensas bonus.`),
  })
  .superRefine((data, ctx) => {
    const maxDay = daysInMonth(data.year, data.month);

    const days = new Set<number>();
    data.rewards.forEach((reward, index) => {
      if (reward.day > maxDay) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Este mês só tem ${maxDay} dias.`,
          path: ["rewards", index, "day"],
        });
      }
      if (days.has(reward.day)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `O dia ${reward.day} já tem uma recompensa cadastrada.`,
          path: ["rewards", index, "day"],
        });
      }
      days.add(reward.day);
    });

    const streakDays = new Set<number>();
    data.bonusRewards.forEach((reward, index) => {
      if (reward.streakDay > maxDay) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Este mês só tem ${maxDay} dias — a sequência não pode passar disso.`,
          path: ["bonusRewards", index, "streakDay"],
        });
      }
      if (streakDays.has(reward.streakDay)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `O dia ${reward.streakDay} já tem uma recompensa bonus cadastrada.`,
          path: ["bonusRewards", index, "streakDay"],
        });
      }
      streakDays.add(reward.streakDay);
    });
  });

export type DailyRewardCompetenciaInput = z.infer<typeof dailyRewardCompetenciaSchema>;

export const defaultDailyRewardCompetenciaValues: DailyRewardCompetenciaInput = {
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  rewards: [],
  bonusRewards: [],
};
