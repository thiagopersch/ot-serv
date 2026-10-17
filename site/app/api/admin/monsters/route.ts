import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { buildPaginatedResult, parseIdsParam, parsePaginationParams, shouldSkipCount } from "@/lib/pagination";
import {
  monsterFormSchema,
  type MonsterFormInput,
} from "@/lib/validations/admin/monster";
import { monsterFormToRow, monsterRowToFormInput } from "@/lib/monster-mapper";
import { syncAutolootFromMonsterLoot } from "@/lib/autoloot-sync";
import { hasDuplicateName } from "@/lib/unique-name";
import { withAudit } from "@/lib/api-audit-wrapper";

const MONSTER_LIST_SELECT = {
  id: true,
  name: true,
  bestiary: true,
  category: true,
  subcategory: true,
  race: true,
  experience: true,
  speed: true,
  healthMax: true,
  published: true,
  lookTypeId: true,
  universe: { select: { id: true, name: true, color: true } },
} as const;

type MonsterListRow = {
  id: number;
  name: string;
  bestiary: string;
  category: string;
  subcategory: string;
  race: string;
  experience: number;
  speed: number;
  healthMax: number;
  published: boolean;
  lookTypeId: number | null;
  universe: { id: number; name: string; color: string | null } | null;
};

function lootMatches(items: MonsterFormInput["loot"], query: string): boolean {
  return items.some(
    (item) =>
      String(item.id) === query ||
      item.comment.toLowerCase().includes(query) ||
      item.text.toLowerCase().includes(query) ||
      lootMatches(item.children, query),
  );
}

function attacksMatch(
  attacks: MonsterFormInput["attacks"],
  query: string,
): boolean {
  return attacks.some(
    (attack) =>
      attack.name.toLowerCase().includes(query) ||
      attack.script.toLowerCase().includes(query),
  );
}

export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const url = new URL(request.url);

  const ids = parseIdsParam(url);
  if (ids) {
    const monstersById = await prisma.monster.findMany({ where: { id: { in: ids } }, select: MONSTER_LIST_SELECT });
    return NextResponse.json(buildPaginatedResult(monstersById, monstersById.length, 1, monstersById.length || 1));
  }

  if (url.searchParams.get("all") === "true") {
    const monsters = await prisma.monster.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, lookTypeId: true },
    });
    return NextResponse.json({ data: monsters });
  }

  const { page, pageSize, search } = parsePaginationParams(url);
  const bestiary = url.searchParams.get("bestiary");
  const category = url.searchParams.get("category");
  const subcategory = url.searchParams.get("subcategory");
  const race = url.searchParams.get("race");
  const lookType = url.searchParams.get("lookType");
  const expMin = url.searchParams.get("expMin");
  const expMax = url.searchParams.get("expMax");
  const hpMin = url.searchParams.get("hpMin");
  const hpMax = url.searchParams.get("hpMax");
const loot = url.searchParams.get("loot")?.trim().toLowerCase();
  const attacks = url.searchParams.get("attacks")?.trim().toLowerCase();
  const hasImageParam = url.searchParams.get("hasImage");

  const where: Prisma.MonsterWhereInput = {
    ...(search ? { name: { contains: search } } : {}),
    ...(hasImageParam === "true"
      ? { lookTypeId: { not: null } }
      : hasImageParam === "false"
        ? { lookTypeId: null }
        : {}),
    ...(bestiary ? { bestiary } : {}),
    ...(category ? { category } : {}),
    ...(subcategory ? { subcategory } : {}),
    ...(race ? { race } : {}),
    ...(lookType ? { lookType: Number(lookType) } : {}),
    ...(expMin || expMax
      ? {
          experience: {
            ...(expMin ? { gte: Number(expMin) } : {}),
            ...(expMax ? { lte: Number(expMax) } : {}),
          },
        }
      : {}),
    ...(hpMin || hpMax
      ? {
          healthMax: {
            ...(hpMin ? { gte: BigInt(hpMin) } : {}),
            ...(hpMax ? { lte: BigInt(hpMax) } : {}),
          },
        }
      : {}),
  };

  // Filtros de loot/attacks exigem inspecionar o JSON — não dá para expressar via
  // where do Prisma, então paginamos em memória só quando um desses filtros é usado.
  if (loot || attacks) {
    const monsters = await prisma.monster.findMany({
      where,
      orderBy: [{ universe: { name: "asc" } }, { subcategory: "asc" }, { name: "asc" }],
      take: 2000,
      include: { universe: { select: { id: true, name: true, color: true } } },
    });
    const filtered = monsters
      .map((row) => ({ row, formInput: monsterRowToFormInput(row) }))
      .filter(({ formInput }) =>
        loot ? lootMatches(formInput.loot, loot) : true,
      )
      .filter(({ formInput }) =>
        attacks ? attacksMatch(formInput.attacks, attacks) : true,
      );

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const pageItems = filtered
      .slice(start, start + pageSize)
      .map(({ row }): MonsterListRow => ({
        id: row.id,
        name: row.name,
        bestiary: row.bestiary,
        category: row.category,
        subcategory: row.subcategory,
        race: row.race,
        experience: row.experience,
        speed: row.speed,
        healthMax: Number(row.healthMax),
        published: row.published,
        lookTypeId: row.lookTypeId,
        universe: row.universe,
      }));

    return NextResponse.json(
      buildPaginatedResult(pageItems, total, page, pageSize),
    );
  }

  const skipCount = shouldSkipCount(url);

  const [monsters, total] = await Promise.all([
    prisma.monster.findMany({
      where,
      orderBy: [{ universe: { name: "asc" } }, { subcategory: "asc" }, { name: "asc" }],
      select: MONSTER_LIST_SELECT,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    skipCount ? Promise.resolve(-1) : prisma.monster.count({ where }),
  ]);

  return NextResponse.json(
    buildPaginatedResult(
      monsters.map((monster) => ({
        ...monster,
        healthMax: Number(monster.healthMax),
      })),
      skipCount ? monsters.length : total,
      page,
      pageSize,
    ),
  );
});

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const body = await request.json();
  const parsed = monsterFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 422 },
    );
  }

  const existingNames = await prisma.monster.findMany({ select: { id: true, name: true } });
  if (hasDuplicateName(existingNames, parsed.data.name)) {
    return NextResponse.json(
      { error: "Já existe um monstro com esse nome." },
      { status: 409 },
    );
  }

  const monster = await prisma.monster.create({
    data: {
      ...monsterFormToRow(parsed.data),
      spells: {
        create: parsed.data.linkedSpellIds.map((spellId) => ({ spellId })),
      },
    },
    include: { spells: { select: { spellId: true } } },
  });

  await syncAutolootFromMonsterLoot(prisma, parsed.data.loot);

  await logAudit({
    accountId: Number(session.user.id),
    action: "create",
    entity: "monster",
    entityId: monster.id,
    metadata: { name: monster.name },
  });

  return NextResponse.json(
    { monster: monsterRowToFormInput(monster) },
    { status: 201 },
  );
});
