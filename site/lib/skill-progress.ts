/** Fórmulas clássicas de progressão do TFS (`vocation.cpp`), usadas para calcular a
 * porcentagem que falta para o próximo nível de uma skill/magic level no ranking.
 * `count`/`manaspent` guardam a tentativa acumulada desde o último level up. */

/** Tentativas necessárias para sair de `level` para `level + 1` numa skill de combate. */
export function getRequiredSkillTries(multiplier: number, level: number): number {
  return Math.floor(multiplier * Math.pow(1.1, level - 11) * 50);
}

/** Mana necessária para sair de `magLevel - 1` para `magLevel`. */
export function getRequiredMana(manaMultiplier: number, magLevel: number): number {
  if (magLevel <= 0) return 0;
  return Math.floor(1600 * Math.pow(manaMultiplier, magLevel - 1));
}

/** Porcentagem que falta (0-100) para avançar de nível, dado o progresso acumulado
 * (`count`/`manaspent`) e o total necessário para o próximo nível. */
export function getMissingPercentage(current: number, required: number): number {
  if (required <= 0) return 0;
  const progress = Math.min(1, Math.max(0, current / required));
  return Math.round((1 - progress) * 1000) / 10;
}
