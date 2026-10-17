/** Tier de donate = quantidade de lançamentos em `donations` por conta (não soma de `amount`).
 * Espelhado em `data/lib/donate_tier.lua` (servidor) — qualquer mudança aqui precisa ser
 * replicada lá manualmente, não há uma única fonte executável entre TS e Lua.
 *
 * As faixas do pedido original têm lacunas (16-19, 46-49); resolvidas para o tier mais
 * próximo abaixo via `minCount` (ex.: 18 doações ainda é Bronze). */
export const DONATE_TIERS = [
  { key: "diamantite", name: "Diamantite", minCount: 50, bonusPct: 50 },
  { key: "platina", name: "Platina", minCount: 36, bonusPct: 35 },
  { key: "dourado", name: "Dourado", minCount: 26, bonusPct: 20 },
  { key: "prata", name: "Prata", minCount: 20, bonusPct: 15 },
  { key: "bronze", name: "Bronze", minCount: 11, bonusPct: 10 },
  { key: "ferro", name: "Ferro", minCount: 6, bonusPct: 0 },
  { key: "madeira", name: "Madeira", minCount: 0, bonusPct: 0 },
] as const;

export type DonateTier = (typeof DONATE_TIERS)[number];

export function getDonateTier(donationCount: number): DonateTier {
  return DONATE_TIERS.find((tier) => donationCount >= tier.minCount) ?? DONATE_TIERS[DONATE_TIERS.length - 1];
}

/** Bless infinita liberada a partir do primeiro tier com bônus (Bronze+). */
export function hasInfiniteBless(donationCount: number): boolean {
  return getDonateTier(donationCount).bonusPct > 0;
}
