import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Staff (GM e acima, `group_id >= 3` **do player**, não da account) e o player especial
 * "Account Manager" não devem aparecer em nenhuma listagem pública que jogadores navegam
 * (ranking, home, últimas mortes, quem está online, membros de guild). Isso NÃO se aplica
 * à área `/account` do próprio jogador — lá cada um sempre vê seus próprios personagens,
 * seja qual for o group_id.
 *
 * Importante: `players.group_id` é o rank in-game do personagem (normal/tutor/GM/god) e é
 * independente de `accounts.group_id` (nível de acesso ao portal/admin). Um player pode ter
 * `group_id = 2` (tutor in-game) mesmo com a account marcada como admin do portal — a
 * visibilidade pública deve seguir o group_id do player.
 */
export const PUBLIC_LISTING_GROUP_ID_LIMIT = 3;
export const ACCOUNT_MANAGER_NAME = "Account Manager";

/** Filtro Prisma reutilizável em `Player.where` direto ou dentro de uma relação
 * `player: {...}` (ex.: `PlayerDeath.where`), já que o shape é o mesmo `PlayerWhereInput`. */
export function publicPlayerVisibilityWhere(): Prisma.PlayerWhereInput {
  return {
    groupId: { lt: PUBLIC_LISTING_GROUP_ID_LIMIT },
    name: { not: ACCOUNT_MANAGER_NAME },
  };
}
