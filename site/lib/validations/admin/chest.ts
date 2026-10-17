import { z } from "zod";

/** Máximo de baús simultâneos (module game_chest do OTC: 1 central + 2 laterais). */
export const MAX_CHESTS = 3;
/** Máximo de opções de recompensa sorteáveis por baú. */
export const MAX_CHEST_REWARD_SLOTS = 10;

export const chestRewardSlotSchema = z.object({
  itemId: z.number().int().min(1, "Selecione um item"),
  count: z.number().int().min(1),
});

export const chestSchema = z.object({
  name: z.string().min(1, "Informe um nome").max(100),
  keyItemId: z.number().int().min(1, "Selecione o item-chave"),
  rewards: z
    .array(chestRewardSlotSchema)
    .min(1, "Adicione ao menos uma recompensa")
    .max(MAX_CHEST_REWARD_SLOTS, `No máximo ${MAX_CHEST_REWARD_SLOTS} recompensas por baú`),
  /** Período de vigência (mês+ano de início e fim) — permite configurar rotação de prêmios. */
  startMonth: z.number().int().min(1).max(12),
  startYear: z.number().int().min(2000),
  endMonth: z.number().int().min(1).max(12),
  endYear: z.number().int().min(2000),
  published: z.boolean(),
});

export type ChestInput = z.infer<typeof chestSchema>;

const now = new Date();

export const defaultChestValues: ChestInput = {
  name: "",
  keyItemId: 0,
  rewards: [],
  startMonth: now.getMonth() + 1,
  startYear: now.getFullYear(),
  endMonth: now.getMonth() + 1,
  endYear: now.getFullYear(),
  published: true,
};
