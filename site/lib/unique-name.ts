type NameRow = { id: number; name: string };

/**
 * Compara nomes ignorando maiúsculas/minúsculas e espaços nas pontas ("Dragon" e
 * "dragon " contam como o mesmo nome). Não dá pra garantir isso só com um `where` do
 * Prisma no MySQL sem depender da collation real da coluna (`_ci` vs `_bin`), então a
 * comparação é feita em memória contra todas as linhas — mesma técnica já usada nos
 * filtros de conteúdo JSON (`lib/brush-item-ids.ts`), aceitável para estas tabelas de
 * catálogo administrativo (nunca a de players/personagens).
 */
export function hasDuplicateName(rows: NameRow[], name: string, excludeId?: number): boolean {
  const normalized = name.trim().toLowerCase();
  return rows.some((row) => row.id !== excludeId && row.name.trim().toLowerCase() === normalized);
}
