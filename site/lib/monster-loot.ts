import type { MonsterLootItemInput } from "@/lib/validations/admin/monster";

/** Achata a árvore de loot (containers dentro de containers) numa lista plana de item ids —
 * usado na box de preview do form (mostra todas as sprites que o monstro pode dropar, sem
 * distinguir profundidade do container). */
export function flattenLootItemIds(items: MonsterLootItemInput[]): number[] {
  return items
    .flatMap((item) => [item.id, ...flattenLootItemIds(item.children ?? [])])
    .filter((id) => id > 0);
}

/** Achata a árvore de loot coletando os itens marcados com `addToAutoloot`, para publicá-los
 * no catálogo de `AutolootItem` ao salvar o monstro. */
export function flattenAutolootCandidates(
  items: MonsterLootItemInput[],
): { itemId: number; name: string }[] {
  return items.flatMap((item) => [
    ...(item.addToAutoloot && item.id > 0 ? [{ itemId: item.id, name: item.comment || `Item #${item.id}` }] : []),
    ...flattenAutolootCandidates(item.children ?? []),
  ]);
}
