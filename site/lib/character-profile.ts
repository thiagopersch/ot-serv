import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { ACCOUNT_MANAGER_NAME, PUBLIC_LISTING_GROUP_ID_LIMIT } from "@/lib/public-player-visibility";

export type RankMode = "level" | "resets";

/** Posição do player no ranking público, com o mesmo critério de ordenação/tiebreak usado em
 * `app/api/public/ranking/route.ts` (coluna DESC, experience DESC). Posição = quantidade de
 * players "à frente" (mesmos filtros de visibilidade pública) + 1. */
export async function getRankPosition(
  mode: RankMode,
  value: number,
  experience: bigint
): Promise<number> {
  const column = mode === "level" ? Prisma.sql`level` : Prisma.sql`resets`;

  const rows = await prisma.$queryRaw<{ ahead: bigint }[]>`
    SELECT COUNT(*) AS ahead
    FROM players p
    WHERE p.deleted = 0
      AND p.group_id < ${PUBLIC_LISTING_GROUP_ID_LIMIT}
      AND p.name != ${ACCOUNT_MANAGER_NAME}
      AND (${column} > ${value} OR (${column} = ${value} AND p.experience > ${experience}))
  `;

  return Number(rows[0]?.ahead ?? 0) + 1;
}

/** Contagem de frags injustificados (fora de war) nos últimos N dias, mesmo filtro usado pelo
 * comando `!frags` do servidor (`data/talkactions/scripts/frags.lua`). */
export async function getFragCounts(playerId: number): Promise<{
  last7: number;
  last15: number;
  last30: number;
}> {
  const now = Math.floor(Date.now() / 1000);
  const rows = await prisma.$queryRaw<{ date: number }[]>`
    SELECT pd.date AS date
    FROM player_killers pk
    LEFT JOIN killers k ON pk.kill_id = k.id
    LEFT JOIN player_deaths pd ON k.death_id = pd.id
    WHERE pk.player_id = ${playerId} AND k.unjustified = 1 AND k.war = 0
      AND pd.date >= ${now - 30 * 24 * 60 * 60}
  `;

  const count = (days: number) => rows.filter((row) => row.date >= now - days * 24 * 60 * 60).length;

  return { last7: count(7), last15: count(15), last30: count(30) };
}

/** Média de level nos resets — retorna `null` quando não há histórico ainda (feature nova,
 * sem backfill retroativo; ver AGENTS.md/plano). */
export async function getResetAverage(playerId: number): Promise<number | null> {
  const result = await prisma.playerResetHistory.aggregate({
    where: { playerId },
    _avg: { level: true },
  });

  return result._avg.level == null ? null : Math.round(result._avg.level);
}
