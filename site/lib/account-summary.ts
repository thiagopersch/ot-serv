import { prisma } from "@/lib/prisma";

const REPORTS_LIMIT = 20;

export async function getAccountSummary(accountId: number) {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { name: true, premdays: true, blocked: true },
  });

  if (!account) return null;

  const players = await prisma.player.findMany({
    where: { accountId, deleted: 0 },
    orderBy: { id: "asc" },
    select: { id: true, name: true, level: true, vocation: true, worldId: true, online: true },
  });

  const vocationIds = [...new Set(players.map((player) => player.vocation))];
  const vocations = vocationIds.length
    ? await prisma.vocation.findMany({
        where: { id: { in: vocationIds } },
        select: { id: true, name: true },
      })
    : [];
  const vocationNameById = new Map(vocations.map((vocation) => [vocation.id, vocation.name]));

  const playerIds = players.map((player) => player.id);
  const reports = playerIds.length
    ? await prisma.serverReport.findMany({
        where: { playerId: { in: playerIds } },
        orderBy: { timestamp: "desc" },
        take: REPORTS_LIMIT,
      })
    : [];

  const openTicketsCount = await prisma.ticket.count({
    where: { accountId, status: { not: "closed" } },
  });

  return {
    account: {
      name: account.name,
      premdays: account.premdays,
      isVip: account.premdays > 0,
      blocked: account.blocked,
    },
    characters: players.map((player) => ({
      id: player.id,
      name: player.name,
      level: player.level,
      vocationName: vocationNameById.get(player.vocation) ?? "Desconhecida",
      worldId: player.worldId,
      online: player.online,
    })),
    reports: reports.map((report) => ({
      id: report.id,
      report: report.report,
      timestamp: report.timestamp,
    })),
    openTicketsCount,
  };
}
