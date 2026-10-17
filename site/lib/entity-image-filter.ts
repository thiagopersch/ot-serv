import { prisma } from "@/lib/prisma";
import type { EntityImageType } from "@/lib/entity-image";

/** Ids de entidade que têm imagem custom anexada (`EntityImage`) — usado pelo filtro
 * "Possui imagem" das listagens de item/monster/spell/vocation. */
export async function entityIdsWithImage(entityType: EntityImageType): Promise<number[]> {
  const rows = await prisma.entityImage.findMany({
    where: { entityType },
    select: { entityId: true },
  });
  return rows.map((row) => row.entityId);
}

/** Lê `?hasImage=true|false` e retorna o filtro Prisma `IntFilter` (`in`/`notIn`) a mesclar
 * no `id` do `where` — ou `null` se o param não foi informado. */
export async function hasImageIdFilter(
  entityType: EntityImageType,
  hasImageParam: string | null
): Promise<{ in: number[] } | { notIn: number[] } | null> {
  if (hasImageParam !== "true" && hasImageParam !== "false") return null;

  const idsWithImage = await entityIdsWithImage(entityType);
  return hasImageParam === "true" ? { in: idsWithImage } : { notIn: idsWithImage };
}
