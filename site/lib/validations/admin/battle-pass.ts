import { z } from "zod";

export const BATTLE_PASS_MISSION_TYPES = [
  "kill_monster",
  "dungeon_any_vocation",
  "dungeon_specific_vocation",
  "damage",
  "battle_pass_missions",
  "daily_tasks",
  "specific_tasks",
  "daily_rewards",
  "vocation_rank",
] as const;

export type BattlePassMissionType = (typeof BATTLE_PASS_MISSION_TYPES)[number];

export const BATTLE_PASS_MISSION_TYPE_LABELS: Record<BattlePassMissionType, string> = {
  kill_monster: "Matar monstros",
  dungeon_any_vocation: "Finalizar dungeons (qualquer vocação)",
  dungeon_specific_vocation: "Finalizar dungeons (vocação específica)",
  damage: "Causar dano",
  battle_pass_missions: "Completar outras missões do passe",
  daily_tasks: "Completar daily tasks",
  specific_tasks: "Completar tasks específicas",
  daily_rewards: "Resgatar daily rewards",
  vocation_rank: "Atingir rank de vocação",
};

/** Rótulo do campo "Quantidade" — o significado muda conforme o Tipo da missão. */
export const BATTLE_PASS_MISSION_AMOUNT_LABELS: Record<BattlePassMissionType, string> = {
  kill_monster: "Quantidade",
  dungeon_any_vocation: "Dungeons a finalizar",
  dungeon_specific_vocation: "Dungeons a finalizar",
  damage: "Dano a causar",
  battle_pass_missions: "Missões do passe a completar",
  daily_tasks: "Daily tasks a completar",
  specific_tasks: "Tasks específicas a completar",
  daily_rewards: "Daily rewards a resgatar",
  vocation_rank: "",
};

export const BATTLE_PASS_TRACKS = ["bronze", "gold"] as const;
export const BATTLE_PASS_TRACK_LABELS: Record<(typeof BATTLE_PASS_TRACKS)[number], string> = {
  bronze: "Bronze",
  gold: "Gold",
};

export const BATTLE_PASS_RARITIES = [
  "comum",
  "incomum",
  "raro",
  "super_raro",
  "lendario",
  "mitico",
] as const;

export const BATTLE_PASS_RARITY_LABELS: Record<(typeof BATTLE_PASS_RARITIES)[number], string> = {
  comum: "Comum",
  incomum: "Incomum",
  raro: "Raro",
  super_raro: "Super Raro",
  lendario: "Lendário",
  mitico: "Mítico",
};

/** Ordem de raridade esperada conforme o level sobe — usado para validar `BattlePassReward`. */
export const RARITY_ORDER: Record<(typeof BATTLE_PASS_RARITIES)[number], number> = {
  comum: 0,
  incomum: 1,
  raro: 2,
  super_raro: 3,
  lendario: 4,
  mitico: 5,
};

export const battlePassMissionTargetSchema = z.object({
  monster: z.string().optional(),
  amount: z.number().int().min(1).optional(),
  vocationId: z.number().int().positive().optional(),
  rank: z.number().int().min(1).max(4).optional(),
});

export const battlePassMissionSchema = z.object({
  type: z.enum(BATTLE_PASS_MISSION_TYPES),
  target: battlePassMissionTargetSchema,
  description: z.string().min(1).max(255),
  xpReward: z.number().int().min(0),
  published: z.boolean(),
});

export const battlePassRewardSchema = z.object({
  level: z.number().int().min(1),
  track: z.enum(BATTLE_PASS_TRACKS),
  rarity: z.enum(BATTLE_PASS_RARITIES),
  itemId: z.number().int().positive(),
  count: z.number().int().min(1),
  order: z.number().int().min(0),
});

export const battlePassSeasonSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z
    .number()
    .int()
    .min(1000)
    .max(9999),
  maxLevel: z.number().int().min(1),
  xpPerLevel: z.number().int().min(1),
  goldPassItemId: z.number().int().min(0),
  goldPassCost: z.number().int().min(0),
  levelPurchaseItemId: z.number().int().min(0),
  levelPurchaseCost: z.number().int().min(0),
  missions: z.array(battlePassMissionSchema),
  rewards: z.array(battlePassRewardSchema),
});

export type BattlePassMissionInput = z.infer<typeof battlePassMissionSchema>;
export type BattlePassRewardInput = z.infer<typeof battlePassRewardSchema>;
export type BattlePassSeasonInput = z.infer<typeof battlePassSeasonSchema>;

export const defaultBattlePassSeasonValues: BattlePassSeasonInput = {
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  maxLevel: 100,
  xpPerLevel: 1000,
  goldPassItemId: 0,
  goldPassCost: 0,
  levelPurchaseItemId: 0,
  levelPurchaseCost: 0,
  missions: [],
  rewards: [],
};

/** Garante que, dentro de cada trilha, a raridade das recompensas cresça junto com o level
 * (múltiplos itens no mesmo level devem ter a mesma raridade), e que nenhum item se repita no
 * mesmo level+trilha (itens diferentes podem se repetir em levels diferentes). Retorna a
 * primeira mensagem de erro encontrada. */
export function validateRewardsOrdering(rewards: BattlePassRewardInput[]): string | null {
  const byTrack = new Map<string, BattlePassRewardInput[]>();
  for (const reward of rewards) {
    const list = byTrack.get(reward.track) ?? [];
    list.push(reward);
    byTrack.set(reward.track, list);
  }

  for (const [track, list] of byTrack) {
    const byLevel = new Map<number, BattlePassRewardInput[]>();
    for (const reward of list) {
      const levelList = byLevel.get(reward.level) ?? [];
      levelList.push(reward);
      byLevel.set(reward.level, levelList);
    }

    for (const [level, levelRewards] of byLevel) {
      const itemIds = new Set<number>();
      for (const reward of levelRewards) {
        if (itemIds.has(reward.itemId)) {
          return `Trilha "${track}", level ${level}: o item #${reward.itemId} está repetido nesse level.`;
        }
        itemIds.add(reward.itemId);
      }
    }

    const levels = [...byLevel.keys()].sort((a, b) => a - b);
    for (let i = 1; i < levels.length; i++) {
      const previousMinOrder = Math.min(...byLevel.get(levels[i - 1])!.map((r) => RARITY_ORDER[r.rarity]));
      const currentMinOrder = Math.min(...byLevel.get(levels[i])!.map((r) => RARITY_ORDER[r.rarity]));
      if (currentMinOrder < previousMinOrder) {
        return `Trilha "${track}": level ${levels[i]} é menos raro que o level ${levels[i - 1]} — a raridade deve crescer com o level.`;
      }
    }
  }

  return null;
}
