import dayjs from "dayjs";

import { prisma } from "@/lib/prisma";
import { BAN_TYPES } from "@/lib/validations/admin/ban";
import { SLOT_TYPES, WEAPON_TYPES } from "@/lib/validations/admin/item";
import { TASK_DIFFICULTY_LABELS, type TaskDifficulty } from "@/lib/task-difficulty";
import { BATTLE_PASS_MISSION_TYPE_LABELS, type BattlePassMissionType } from "@/lib/validations/admin/battle-pass";

const NPC_TYPE_LABELS: Record<string, string> = { shop: "Loja", quest: "Quest", misc: "Outro" };

const TREND_DAYS = 30;

function percentChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

function accountGroupLabel(groupId: number): string {
  if (groupId === 1) return "Jogador";
  if (groupId === 2) return "Tutor";
  if (groupId === 6) return "Admin master";
  if (groupId >= 3) return "GM/Admin";
  return "Outro";
}

function bucketByDay(dates: Date[]): Record<string, number> {
  const buckets: Record<string, number> = {};
  for (const date of dates) {
    const key = dayjs(date).format("YYYY-MM-DD");
    buckets[key] = (buckets[key] ?? 0) + 1;
  }
  return buckets;
}

export type DashboardStats = Awaited<ReturnType<typeof getDashboardStats>>;

export async function getDashboardStats() {
  const now = dayjs();
  const since30 = now.subtract(TREND_DAYS, "day").startOf("day").toDate();
  const since7 = now.subtract(7, "day").toDate();
  const since14 = now.subtract(14, "day").toDate();
  const startOfToday = now.startOf("day").toDate();
  const endOfToday = now.endOf("day").toDate();

  const [
    totalAccounts,
    accountsLast7,
    accountsPrev7,
    latestAccounts,
    accountsByGroup,
    accountsCreatedRecent,

    totalPlayers,
    playersLast7,
    playersPrev7,
    latestPlayers,
    playersCreatedRecent,

    totalMonsters,
    monstersByCategory,

    itemsBySlotType,
    itemsByWeaponType,

    totalBans,
    activeBans,
    latestBans,
    bansByType,

    monsterBoostToday,

    openTickets,
    ticketsByStatus,

    vocationsByArchetype,
    vocationsByTypeUniverse,
    vocationsByPremium,
    vocationsByRank,

    spellVocationLinks,
    spellsWithoutVocation,
    npcsByType,
    tasksByCategory,
    tasksByDifficulty,
    questsByCategory,
    activeBattlePassSeason,
    towns,
    dailyRewardToday,
    lastLotteryWinner,
    activeChests,

    archetypes,
    typeUniverses,
  ] = await Promise.all([
    prisma.account.count(),
    prisma.account.count({ where: { createdAt: { gte: since7 } } }),
    prisma.account.count({
      where: { createdAt: { gte: since14, lt: since7 } },
    }),
    prisma.account.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, createdAt: true, groupId: true },
    }),
    prisma.account.groupBy({ by: ["groupId"], _count: { _all: true } }),
    prisma.account.findMany({
      where: { createdAt: { gte: since30 } },
      select: { createdAt: true },
    }),

    prisma.player.count({ where: { deleted: 0 } }),
    prisma.player.count({ where: { deleted: 0, createdAt: { gte: since7 } } }),
    prisma.player.count({
      where: { deleted: 0, createdAt: { gte: since14, lt: since7 } },
    }),
    prisma.player.findMany({
      where: { deleted: 0 },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, level: true, createdAt: true },
    }),
    prisma.player.findMany({
      where: { deleted: 0, createdAt: { gte: since30 } },
      select: { createdAt: true },
    }),

    prisma.monster.count(),
    prisma.monster.groupBy({ by: ["category"], _count: { _all: true } }),

    prisma.item.groupBy({ by: ["slotType"], _count: { _all: true } }),
    prisma.item.groupBy({ by: ["weaponType"], _count: { _all: true } }),

    prisma.ban.count(),
    prisma.ban.count({ where: { active: true } }),
    prisma.ban.findMany({ orderBy: { added: "desc" }, take: 5 }),
    prisma.ban.groupBy({ by: ["type"], _count: { _all: true } }),

    prisma.monsterBoost.findFirst({
      where: { date: { gte: startOfToday, lte: endOfToday } },
      orderBy: { id: "desc" },
    }),

    prisma.ticket.count({ where: { status: "open" } }),
    prisma.ticket.groupBy({ by: ["status"], _count: { _all: true } }),

    prisma.vocation.groupBy({ by: ["archetypeId"], _count: { _all: true } }),
    prisma.vocation.groupBy({ by: ["typeUniverseId"], _count: { _all: true } }),
    prisma.vocation.groupBy({ by: ["needpremium"], _count: { _all: true } }),
    prisma.vocation.groupBy({ by: ["maxRank"], _count: { _all: true } }),

    prisma.spellVocation.groupBy({ by: ["vocationId"], where: { vocationId: { not: 0 } }, _count: { _all: true } }),
    prisma.spell.count({ where: { vocations: { none: {} } } }),
    prisma.npc.groupBy({ by: ["type"], _count: { _all: true } }),
    prisma.taskDefinition.groupBy({ by: ["category"], _count: { _all: true } }),
    prisma.taskDefinition.groupBy({ by: ["difficulty"], _count: { _all: true } }),
    prisma.quest.groupBy({ by: ["category"], _count: { _all: true } }),
    prisma.battlePassSeason.findFirst({
      where: { isActive: true },
      include: { missions: { select: { type: true } } },
    }),
    prisma.town.findMany({
      where: { published: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, templeX: true, templeY: true, templeZ: true },
    }),
    prisma.dailyRewardsMonthly.findFirst({
      where: { day: now.date(), month: now.month() + 1, year: now.year() },
    }),
    prisma.lottery.findFirst({ orderBy: { createdAt: "desc" } }),
    prisma.chest.findMany({
      where: {
        published: true,
        OR: [
          { startYear: { lt: now.year() } },
          { startYear: now.year(), startMonth: { lte: now.month() + 1 } },
        ],
        AND: [
          {
            OR: [
              { endYear: { gt: now.year() } },
              { endYear: now.year(), endMonth: { gte: now.month() + 1 } },
            ],
          },
        ],
      },
    }),

    prisma.vocationArchetype.findMany({ select: { id: true, name: true } }),
    prisma.universe.findMany({ select: { id: true, name: true } }),
  ]);

  const monsterBoostTodayMonster = monsterBoostToday
    ? await prisma.monster.findUnique({
        where: { name: monsterBoostToday.monster },
        select: { id: true, lookTypeId: true },
      })
    : null;
  const [monsterBoostTodayImage, monsterBoostTodayLooktype] = await Promise.all([
    monsterBoostTodayMonster
      ? prisma.entityImage.findUnique({
          where: {
            entityType_entityId: {
              entityType: "monster",
              entityId: monsterBoostTodayMonster.id,
            },
          },
          select: { extension: true, updatedAt: true },
        })
      : Promise.resolve(null),
    monsterBoostTodayMonster?.lookTypeId
      ? prisma.looktype.findUnique({
          where: { id: monsterBoostTodayMonster.lookTypeId },
          select: { id: true, frameCount: true, frameDurationsMs: true, updatedAt: true },
        })
      : Promise.resolve(null),
  ]);

  const accountBuckets = bucketByDay(
    accountsCreatedRecent.map((row) => row.createdAt),
  );
  const playerBuckets = bucketByDay(
    playersCreatedRecent.map((row) => row.createdAt),
  );

  const createdTrend = Array.from({ length: TREND_DAYS }, (_, index) => {
    const day = now.subtract(TREND_DAYS - 1 - index, "day");
    const key = day.format("YYYY-MM-DD");
    return {
      date: key,
      label: day.format("DD/MM"),
      contas: accountBuckets[key] ?? 0,
      players: playerBuckets[key] ?? 0,
    };
  });

  const groupLabelTotals = new Map<string, number>();
  for (const row of accountsByGroup) {
    const label = accountGroupLabel(row.groupId);
    groupLabelTotals.set(
      label,
      (groupLabelTotals.get(label) ?? 0) + row._count._all,
    );
  }
  const accountsByGroupChart = Array.from(
    groupLabelTotals,
    ([label, total]) => ({ label, total }),
  );

  const banTypeLabelOf = (type: number) =>
    BAN_TYPES.find((t) => t.value === type)?.label ?? `Tipo ${type}`;
  const bansByTypeChart = bansByType.map((row) => ({
    label: banTypeLabelOf(row.type),
    total: row._count._all,
  }));

  // Quantidade de items por slot (head/body/legs/...) + por weapon type (sword/axe/...)
  // num único gráfico — um item pode contar em ambos (ex.: uma espada tem slotType="hand"
  // e weaponType="sword"), cada eixo é uma classificação independente do item.
  const slotTypeTotals = new Map(itemsBySlotType.map((row) => [row.slotType, row._count._all]));
  const weaponTypeTotals = new Map(itemsByWeaponType.map((row) => [row.weaponType, row._count._all]));
  const itemsByTypeChart = [
    ...SLOT_TYPES.filter(Boolean).map((slot) => ({ label: slot, total: slotTypeTotals.get(slot) ?? 0 })),
    ...WEAPON_TYPES.filter(Boolean).map((weapon) => ({ label: weapon, total: weaponTypeTotals.get(weapon) ?? 0 })),
  ];

  const monstersByCategoryChart = monstersByCategory
    .map((row) => ({
      label: row.category || "Sem universo",
      total: row._count._all,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const ticketStatusLabels: Record<string, string> = {
    open: "Aberto",
    answered: "Respondido",
    closed: "Fechado",
  };
  const ticketsByStatusChart = ticketsByStatus.map((row) => ({
    label: ticketStatusLabels[row.status] ?? row.status,
    total: row._count._all,
  }));

  const archetypeNameById = new Map(archetypes.map((row) => [row.id, row.name]));
  const typeUniverseNameById = new Map(typeUniverses.map((row) => [row.id, row.name]));

  const vocationsByArchetypeChart = vocationsByArchetype.map((row) => ({
    label: row.archetypeId != null ? (archetypeNameById.get(row.archetypeId) ?? "Sem arquétipo") : "Sem arquétipo",
    total: row._count._all,
  }));
  const vocationsByTypeUniverseChart = vocationsByTypeUniverse.map((row) => ({
    label:
      row.typeUniverseId != null
        ? (typeUniverseNameById.get(row.typeUniverseId) ?? "Sem universo")
        : "Sem universo",
    total: row._count._all,
  }));
  const vocationsByPremiumChart = vocationsByPremium.map((row) => ({
    label: row.needpremium ? "Premium" : "Free",
    total: row._count._all,
  }));
  // Rank máximo por estrelas que a vocação pode alcançar — espelha
  // `VocationRankConfig.Vocations[id].maxRank` (vocation_ranks_config.lua).
  const rankLabels: Record<number, string> = { 0: "Nenhum", 1: "Bronze", 2: "Prata", 3: "Ouro", 4: "Diamante" };
  const vocationsByRankChart = vocationsByRank.map((row) => ({
    label: rankLabels[row.maxRank] ?? `Rank ${row.maxRank}`,
    total: row._count._all,
  }));

  // Spells por vocação (ignorando vocation 0 — sentinela "qualquer/nenhuma" do jogo, não uma
  // vocação real) + spells sem nenhuma vocação vinculada, numa barra própria.
  const spellVocationIds = spellVocationLinks.map((row) => row.vocationId);
  const spellVocationNames =
    spellVocationIds.length > 0
      ? await prisma.vocation.findMany({ where: { id: { in: spellVocationIds } }, select: { id: true, name: true } })
      : [];
  const vocationNameById = new Map(spellVocationNames.map((row) => [row.id, row.name]));
  const spellsByVocationChart = [
    ...spellVocationLinks.map((row) => ({
      label: vocationNameById.get(row.vocationId) ?? `Vocação #${row.vocationId}`,
      total: row._count._all,
    })),
    { label: "Sem vocação", total: spellsWithoutVocation },
  ];

  const npcsByTypeChart = npcsByType.map((row) => ({
    label: NPC_TYPE_LABELS[row.type] ?? row.type,
    total: row._count._all,
  }));

  const tasksByCategoryChart = tasksByCategory.map((row) => ({
    label: row.category || "Sem categoria",
    total: row._count._all,
  }));
  const tasksByDifficultyChart = tasksByDifficulty.map((row) => ({
    label: TASK_DIFFICULTY_LABELS[row.difficulty as TaskDifficulty] ?? row.difficulty,
    total: row._count._all,
  }));
  const questsByCategoryChart = questsByCategory.map((row) => ({
    label: row.category || "Sem categoria",
    total: row._count._all,
  }));

  // Último ganhador da loteria: `Lottery.name`/`item` só guardam texto livre (histórico de
  // sorteios), resolve looktype do player e do item de recompensa pelo nome exato.
  const lastLotteryWinnerData = lastLotteryWinner
    ? await (async () => {
        const [player, item] = await Promise.all([
          prisma.player.findUnique({
            where: { name: lastLotteryWinner.name },
            select: { name: true, looktype: true },
          }),
          prisma.item.findFirst({
            where: { name: lastLotteryWinner.item },
            select: { id: true, name: true, lookTypeId: true },
          }),
        ]);
        // `Player.looktype` é o outfit real (número cru do jogo) — resolve o cadastro
        // correspondente pra poder mostrar a sprite animada (mesmo padrão de monsterBoostToday).
        const playerLooktype = player
          ? await prisma.looktype.findFirst({
              where: { looktypeNumber: player.looktype, category: "outfit" },
              select: { id: true, frameCount: true, frameDurationsMs: true, updatedAt: true },
            })
          : null;
        return { ...lastLotteryWinner, player, item, playerLooktype };
      })()
    : null;

  // Baús vigentes no período atual (mês/ano) — resolve looktype de cada item de recompensa
  // pra montar o card de sprites do dashboard.
  const activeChestsData = await Promise.all(
    activeChests.map(async (chest) => {
      const rewards = chest.rewards as { itemId: number; count: number }[];
      const itemIds = rewards.map((reward) => reward.itemId);
      const items =
        itemIds.length > 0
          ? await prisma.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, name: true } })
          : [];
      const itemById = new Map(items.map((item) => [item.id, item]));
      return {
        id: chest.id,
        name: chest.name,
        rewards: rewards.map((reward) => ({
          itemId: reward.itemId,
          count: reward.count,
          name: itemById.get(reward.itemId)?.name ?? null,
        })),
      };
    }),
  );

  return {
    accounts: {
      total: totalAccounts,
      last7: accountsLast7,
      delta: accountsLast7 - accountsPrev7,
      percent: percentChange(accountsLast7, accountsPrev7),
      latest: latestAccounts,
      byGroup: accountsByGroupChart,
    },
    players: {
      total: totalPlayers,
      last7: playersLast7,
      delta: playersLast7 - playersPrev7,
      percent: percentChange(playersLast7, playersPrev7),
      latest: latestPlayers,
    },
    monsters: {
      total: totalMonsters,
      byCategory: monstersByCategoryChart,
    },
    items: {
      byType: itemsByTypeChart,
    },
    bans: {
      total: totalBans,
      active: activeBans,
      latest: latestBans,
      byType: bansByTypeChart,
    },
    monsterBoostToday: monsterBoostToday
      ? {
          ...monsterBoostToday,
          monsterId: monsterBoostTodayMonster?.id ?? null,
          image: monsterBoostTodayImage,
          looktype: monsterBoostTodayLooktype,
        }
      : null,
    tickets: {
      open: openTickets,
      byStatus: ticketsByStatusChart,
    },
    vocations: {
      byArchetype: vocationsByArchetypeChart,
      byTypeUniverse: vocationsByTypeUniverseChart,
      byPremium: vocationsByPremiumChart,
      byRank: vocationsByRankChart,
    },
    createdTrend,
    spells: {
      byVocation: spellsByVocationChart,
    },
    npcs: {
      byType: npcsByTypeChart,
    },
    tasks: {
      byCategory: tasksByCategoryChart,
      byDifficulty: tasksByDifficultyChart,
    },
    quests: {
      byCategory: questsByCategoryChart,
    },
    battlePassMissionsByType: (() => {
      const missions = activeBattlePassSeason?.missions ?? [];
      const totals = new Map<string, number>();
      for (const mission of missions) {
        totals.set(mission.type, (totals.get(mission.type) ?? 0) + 1);
      }
      return Array.from(totals, ([type, total]) => ({
        label: BATTLE_PASS_MISSION_TYPE_LABELS[type as BattlePassMissionType] ?? type,
        total,
      }));
    })(),
    towns,
    dailyRewardToday,
    lastLotteryWinner: lastLotteryWinnerData,
    activeBattlePass: activeBattlePassSeason
      ? {
          id: activeBattlePassSeason.id,
          month: activeBattlePassSeason.month,
          year: activeBattlePassSeason.year,
          missionCount: activeBattlePassSeason.missions.length,
        }
      : null,
    activeChests: activeChestsData,
  };
}
