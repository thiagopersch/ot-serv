import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { buildPaginatedResult, parsePaginationParams } from "@/lib/pagination";
import { syncActiveSeason } from "@/lib/battle-pass-season";
import { battlePassSeasonSchema, validateRewardsOrdering } from "@/lib/validations/admin/battle-pass";
import { withAudit } from "@/lib/api-audit-wrapper";
import { hasImageIdFilter } from "@/lib/entity-image-filter";
import { MONTH_NAMES } from "@/lib/month-names";

type SeasonWithLists = Prisma.BattlePassSeasonGetPayload<{
  include: {
    missions: { select: { type: true; target: true } };
    rewards: { select: { track: true; rarity: true; itemId: true } };
    _count: { select: { missions: true; rewards: true } };
  };
}>;

/** Resolve um termo de busca (nome ou id numérico) pra uma lista de ids de item —
 * usado pelos filtros "item" (recompensa) e "monstro" (nome livre em `target.monster`). */
async function resolveItemIds(term: string): Promise<number[]> {
  const numericId = Number(term);
  const rows = await prisma.item.findMany({
    where: {
      OR: [{ name: { contains: term } }, ...(Number.isFinite(numericId) ? [{ id: numericId }] : [])],
    },
    select: { id: true },
    take: 500,
  });
  return rows.map((row) => row.id);
}

export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const url = new URL(request.url);
  const { page, pageSize, search } = parsePaginationParams(url);

  const numberParam = (key: string) => {
    const raw = url.searchParams.get(key);
    return raw && Number.isFinite(Number(raw)) ? Number(raw) : null;
  };

  const maxLevel = numberParam("maxLevel");
  const xpPerLevel = numberParam("xpPerLevel");
  const goldPassCost = numberParam("goldPassCost");
  const levelPurchaseCost = numberParam("levelPurchaseCost");
  const missionType = url.searchParams.get("missionType");
  const monster = url.searchParams.get("monster");
  const vocation = url.searchParams.get("vocation");
  const rewardRarity = url.searchParams.get("rewardRarity");
  const track = url.searchParams.get("track");
  const rewardItemTerm = url.searchParams.get("rewardItem");

  const hasImage = await hasImageIdFilter("item", url.searchParams.get("hasImage"));
  const rewardItemIds = rewardItemTerm ? await resolveItemIds(rewardItemTerm) : null;

  const searchMonth = search
    ? MONTH_NAMES.findIndex((name) => name.toLowerCase().includes(search.toLowerCase())) + 1
    : 0;
  const searchYear = search && Number.isFinite(Number(search)) ? Number(search) : null;

  const where: Prisma.BattlePassSeasonWhereInput = {
    ...(search
      ? {
          OR: [
            ...(searchMonth > 0 ? [{ month: searchMonth }] : []),
            ...(searchYear != null ? [{ year: searchYear }] : []),
          ],
        }
      : {}),
    ...(maxLevel != null ? { maxLevel } : {}),
    ...(xpPerLevel != null ? { xpPerLevel } : {}),
    ...(goldPassCost != null ? { goldPassCost } : {}),
    ...(levelPurchaseCost != null ? { levelPurchaseCost } : {}),
    ...(hasImage
      ? { OR: [{ goldPassItemId: hasImage }, { levelPurchaseItemId: hasImage }] }
      : {}),
  };

  const allMatching = await prisma.battlePassSeason.findMany({
    where,
    orderBy: [{ year: "desc" }, { month: "desc" }],
    include: {
      missions: { select: { type: true, target: true } },
      rewards: { select: { track: true, rarity: true, itemId: true } },
      _count: { select: { missions: true, rewards: true } },
    },
  });

  const filtered = allMatching.filter((season: SeasonWithLists) => {
    if (missionType && !season.missions.some((mission) => mission.type === missionType)) return false;
    if (
      monster &&
      !season.missions.some((mission) => {
        const target = mission.target as { monster?: string } | null;
        return target?.monster?.toLowerCase().includes(monster.toLowerCase());
      })
    )
      return false;
    if (
      vocation &&
      !season.missions.some((mission) => {
        const target = mission.target as { vocationId?: number } | null;
        return String(target?.vocationId ?? "") === vocation;
      })
    )
      return false;
    if (rewardRarity && !season.rewards.some((reward) => reward.rarity === rewardRarity)) return false;
    if (track && !season.rewards.some((reward) => reward.track === track)) return false;
    if (rewardItemIds && !season.rewards.some((reward) => rewardItemIds.includes(reward.itemId)))
      return false;
    return true;
  });

  const total = filtered.length;
  const paged = filtered.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

  return NextResponse.json(buildPaginatedResult(paged, total, page, pageSize));
});

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const body = await request.json();
  const parsed = battlePassSeasonSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 422 },
    );
  }

  const { month, year, missions, rewards, ...seasonFields } = parsed.data;

  const orderingError = validateRewardsOrdering(rewards);
  if (orderingError) {
    return NextResponse.json({ error: orderingError }, { status: 422 });
  }

  const existing = await prisma.battlePassSeason.findUnique({ where: { month_year: { month, year } } });
  if (existing) {
    return NextResponse.json({ error: "Já existe uma temporada para esse mês/ano." }, { status: 409 });
  }

  const season = await prisma.battlePassSeason.create({
    data: {
      month,
      year,
      ...seasonFields,
      missions: {
        create: missions.map((mission) => ({
          ...mission,
          target: mission.target as unknown as Prisma.InputJsonValue,
        })),
      },
      rewards: { create: rewards },
    },
  });

  await syncActiveSeason();

  await logAudit({
    accountId: Number(session.user.id),
    action: "create",
    entity: "battle_pass_season",
    entityId: season.id,
    metadata: { month, year },
  });

  return NextResponse.json({ season }, { status: 201 });
});
