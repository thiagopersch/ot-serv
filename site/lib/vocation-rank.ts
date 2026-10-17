/** Espelha `VocationRankConfig.Ranks` em `server/data/lib/vocation_ranks_config.lua` — o
 * índice é o `maxRank` gravado em `vocations.max_rank` (0=None, sem upgrade por estrelas). */
export const VOCATION_RANKS = [0, 1, 2, 3, 4] as const;
export type VocationRank = (typeof VOCATION_RANKS)[number];

export const VOCATION_RANK_LABELS: Record<VocationRank, string> = {
  0: "None",
  1: "Bronze",
  2: "Silver",
  3: "Gold",
  4: "Diamond",
};

export const VOCATION_RANK_COLORS: Record<VocationRank, string> = {
  0: "#aaaaaa",
  1: "#cd7f32",
  2: "#c0c0c0",
  3: "#ffd700",
  4: "#b9f2ff",
};

export function isVocationRank(value: number): value is VocationRank {
  return (VOCATION_RANKS as readonly number[]).includes(value);
}
