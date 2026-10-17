import type { PrismaClient } from "@/lib/generated/prisma/client";
import { flattenAutolootCandidates } from "@/lib/monster-loot";
import type { MonsterLootItemInput } from "@/lib/validations/admin/monster";

/** Publica no catálogo de autoloot (`AutolootItem`) os itens de loot do monstro marcados
 * com `addToAutoloot` — chamado ao criar/editar um monstro. Itens já cadastrados não são
 * duplicados (unique por `itemId`). */
export async function syncAutolootFromMonsterLoot(
  prisma: PrismaClient,
  loot: MonsterLootItemInput[],
): Promise<void> {
  const candidates = flattenAutolootCandidates(loot);
  if (candidates.length === 0) return;

  await Promise.all(
    candidates.map((candidate) =>
      prisma.autolootItem.upsert({
        where: { itemId: candidate.itemId },
        update: { published: true },
        create: { itemId: candidate.itemId, name: candidate.name, published: true },
      }),
    ),
  );
}
