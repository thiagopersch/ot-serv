import { z } from "zod";

export const questRewardItemSchema = z.object({
  itemId: z.number().int().min(1, "Selecione um item"),
  count: z.number().int().min(1),
});

export type QuestRewardItem = z.infer<typeof questRewardItemSchema>;

export const questSchema = z.object({
  name: z.string().min(1, "Informe o nome").max(255),
  description: z.string().min(1, "Informe a descrição"),
  categoryId: z.number().int().min(1, "Selecione uma categoria"),
  levelRequired: z.number().int().min(0),
  rewardExp: z.number().int().min(0),
  rewardMoney: z.number().int().min(0),
  rewardItems: z.array(questRewardItemSchema),
  published: z.boolean(),
});

export type QuestInput = z.infer<typeof questSchema>;

export const defaultQuestValues: QuestInput = {
  name: "",
  description: "",
  categoryId: 0,
  levelRequired: 0,
  rewardExp: 0,
  rewardMoney: 0,
  rewardItems: [],
  published: true,
};

/** Payload pro Prisma — resolve `categoryId` -> `category` (string denormalizada que o
 * engine lê) e mantém `rewardItemId`/`rewardItemCount` sincronizados com o 1º item de
 * `rewardItems` (compat com scripts Lua legados que esperam um único item de recompensa). */
export function questInputToPrismaData(input: QuestInput, categoryName: string) {
  const { categoryId, rewardItems, ...rest } = input;
  const [firstReward] = rewardItems;

  return {
    ...rest,
    categoryId,
    category: categoryName,
    rewardItems,
    rewardItemId: firstReward?.itemId ?? null,
    rewardItemCount: firstReward?.count ?? 1,
  };
}
