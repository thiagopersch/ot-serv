/** Chave de rota "YYYY-M" (ex.: "2026-8") pra uma competência de daily rewards — as tabelas
 * `daily_rewards_monthly`/`daily_rewards_bonus_monthly` não têm um id substituto, a PK composta
 * é `[month, year, day]`/`[month, year, streakDay]`, então usamos ano/mês como identificador de
 * rota em vez de criar uma tabela "season" só pra isso (mesmo problema que `BattlePassSeason`
 * resolve com um `id` autoincrement — aqui não vale a pena pela quantidade de linhas). */
export function parseCompetenciaParam(param: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{1,2})$/.exec(param);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

export function competenciaId(year: number, month: number): string {
  return `${year}-${month}`;
}

/** Dias do mês (fevereiro com 28/29). Mesmo cálculo de `DailyReward.getDaysInMonth` no servidor. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Marcos de dias consecutivos das recompensas bonus. Fevereiro não chega a 30 dias, então o
 * último marco fica no dia 28 (inclusive em ano bissexto) — espelha
 * `DailyReward.getBonusMilestones` em `server/data/lib/daily_reward.lua`. */
export function bonusMilestones(month: number): number[] {
  return [5, 10, 15, 20, 25, month === 2 ? 28 : 30];
}
