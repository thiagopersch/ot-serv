import { prisma } from "@/lib/prisma";
import { bonusMilestones, daysInMonth } from "@/lib/daily-reward-competencia";
import type {
  DailyRewardBonusEntryInput,
  DailyRewardEntryInput,
} from "@/lib/validations/admin/daily-reward";
import {
  DAILY_REWARD_RARITIES,
  emptyDailyRewardDefaultValues,
  type DailyRewardDefaultInput,
  type DailyRewardPoolItemInput,
} from "@/lib/validations/admin/daily-reward-default";

/** Lê o padrão de recompensas (`/admin/daily-rewards/default`) do banco. */
export async function loadDailyRewardDefault(): Promise<DailyRewardDefaultInput> {
  const [items, weights, outfits] = await Promise.all([
    prisma.dailyRewardDefaultItem.findMany({ where: { active: true }, orderBy: { id: "asc" } }),
    prisma.dailyRewardRarityWeight.findMany(),
    prisma.dailyRewardDefaultOutfit.findMany({ orderBy: { id: "asc" } }),
  ]);

  const pool: DailyRewardDefaultInput = structuredClone(emptyDailyRewardDefaultValues);
  const isRarity = (value: string | null): value is (typeof DAILY_REWARD_RARITIES)[number] =>
    (DAILY_REWARD_RARITIES as readonly string[]).includes(value ?? "");

  for (const row of weights) {
    if (isRarity(row.rarity)) pool.weights[row.rarity] = row.weight;
  }
  for (const row of items) {
    const entry = { itemId: row.itemId, clientId: row.clientId, count: row.count };
    if (row.kind === "bonus") pool.bonus.push(entry);
    else if (isRarity(row.rarity)) pool.daily[row.rarity].push(entry);
  }
  pool.customOutfitIds = outfits.map((o) => o.customOutfitId);

  return pool;
}

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

function rollDailyItem(pool: DailyRewardDefaultInput): DailyRewardPoolItemInput | null {
  const usable = DAILY_REWARD_RARITIES.filter(
    (rarity) => pool.daily[rarity].length > 0 && pool.weights[rarity] > 0,
  );
  const total = usable.reduce((sum, rarity) => sum + pool.weights[rarity], 0);
  if (total <= 0) return null;

  let roll = Math.random() * total;
  for (const rarity of usable) {
    roll -= pool.weights[rarity];
    if (roll < 0) return pick(pool.daily[rarity]);
  }
  return pick(pool.daily[usable[usable.length - 1]]);
}

/** Gera as recompensas de um mês a partir do padrão — mesmo algoritmo que o servidor usa na
 * virada do mês (`DailyReward.ensureMonth`): sorteio de raridade por peso, item aleatório da
 * raridade, e um item bonus aleatório por marco (último marco no dia 28 em fevereiro). */
export function generateCompetenciaFromDefault(
  pool: DailyRewardDefaultInput,
  year: number,
  month: number,
): { rewards: DailyRewardEntryInput[]; bonusRewards: DailyRewardBonusEntryInput[] } {
  const rewards: DailyRewardEntryInput[] = [];
  for (let day = 1; day <= daysInMonth(year, month); day++) {
    const item = rollDailyItem(pool);
    if (!item) break;
    rewards.push({ day, ...item });
  }

  const bonusRewards: DailyRewardBonusEntryInput[] =
    pool.bonus.length === 0
      ? []
      : bonusMilestones(month).map((streakDay) => ({ streakDay, ...pick(pool.bonus) }));

  return { rewards, bonusRewards };
}
