import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth-constants";
import { prisma } from "@/lib/prisma";
import { ACCOUNT_MANAGER_NAME, PUBLIC_LISTING_GROUP_ID_LIMIT } from "@/lib/public-player-visibility";
import { getRankPosition, getResetAverage } from "@/lib/character-profile";
import { getDonateTier } from "@/lib/donate-tier";

type Params = { params: Promise<{ name: string }> };

/** Slots de equipamento raiz do inventário: itens equipados têm `pid` = `CONST_SLOT_*` do
 * engine (1 head, 2 necklace, 3 backpack, 4 armor, 5 right-hand, 6 left-hand, 7 legs,
 * 8 feet, 9 ring, 10 ammo) — `sid` é só um id sequencial único da linha, não o slot
 * (confirmado direto na tabela `player_items`: um item equipado tem `pid=4` (armor),
 * não `pid=0`; itens dentro de um container têm `pid` = `sid` do container pai). */
const EQUIPMENT_SLOTS = [
  { pid: 1, key: "head" },
  { pid: 2, key: "necklace" },
  { pid: 3, key: "backpack" },
  { pid: 4, key: "armor" },
  { pid: 5, key: "rightHand" },
  { pid: 6, key: "leftHand" },
  { pid: 7, key: "legs" },
  { pid: 8, key: "feet" },
  { pid: 9, key: "ring" },
  { pid: 10, key: "ammo" },
] as const;
export type EquipmentSlotKey = (typeof EQUIPMENT_SLOTS)[number]["key"];

export async function GET(_request: Request, { params }: Params) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);

  if (decodedName === ACCOUNT_MANAGER_NAME) {
    return NextResponse.json({ error: "Personagem não encontrado." }, { status: 404 });
  }

  const session = await auth();
  // Contas com group_id >= 5 (admin) veem o perfil de qualquer personagem, inclusive staff
  // in-game e personagens deletados — o resto do público continua com as restrições normais.
  const where: Prisma.PlayerWhereInput = isAdmin(session?.user?.groupId)
    ? { name: decodedName }
    : { name: decodedName, deleted: 0, groupId: { lt: PUBLIC_LISTING_GROUP_ID_LIMIT } };

  const player = await prisma.player.findFirst({
    where,
    select: {
      id: true,
      name: true,
      level: true,
      vocation: true,
      experience: true,
      sex: true,
      online: true,
      lastlogin: true,
      lastlogout: true,
      rankId: true,
      resets: true,
      balance: true,
      cap: true,
      soul: true,
      health: true,
      healthmax: true,
      mana: true,
      manamax: true,
      townId: true,
      age: true,
      createdAt: true,
      accountId: true,
    },
  });

  if (!player) {
    return NextResponse.json(
      { error: "Personagem não encontrado." },
      { status: 404 },
    );
  }

  const [
    rank,
    vocation,
    equippedItems,
    town,
    vocationImage,
    otherPlayers,
    rankByLevel,
    rankByResets,
    donationCount,
    resetAverage,
    account,
  ] = await Promise.all([
      player.rankId
        ? prisma.guildRank.findUnique({
            where: { id: player.rankId },
            include: { guild: { select: { id: true, name: true } } },
          })
        : null,
      prisma.vocation.findUnique({
        where: { id: player.vocation },
        select: { name: true },
      }),
      prisma.playerItem.findMany({
        where: {
          playerId: player.id,
          pid: { in: EQUIPMENT_SLOTS.map((slot) => slot.pid) },
        },
        select: { pid: true, itemtype: true },
      }),
      prisma.town.findUnique({ where: { id: player.townId }, select: { name: true } }),
      prisma.entityImage.findUnique({
        where: { entityType_entityId: { entityType: "vocation", entityId: player.vocation } },
        select: { extension: true, updatedAt: true },
      }),
      prisma.player.findMany({
        where: {
          accountId: player.accountId,
          deleted: 0,
          id: { not: player.id },
        },
        orderBy: [{ resets: "desc" }, { level: "desc" }],
        select: { id: true, name: true, level: true, resets: true, vocation: true, online: true },
      }),
      getRankPosition("level", player.level, player.experience),
      getRankPosition("resets", player.resets, player.experience),
      prisma.donation.count({ where: { accountId: player.accountId } }),
      getResetAverage(player.id),
      prisma.account.findUnique({ where: { id: player.accountId }, select: { groupId: true } }),
    ]);

  const donateTier = getDonateTier(donationCount);

  const otherPlayerVocationIds = Array.from(new Set(otherPlayers.map((p) => p.vocation)));
  const [otherPlayerVocations, otherPlayerVocationImages] = await Promise.all([
    otherPlayerVocationIds.length
      ? prisma.vocation.findMany({
          where: { id: { in: otherPlayerVocationIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    otherPlayerVocationIds.length
      ? prisma.entityImage.findMany({
          where: { entityType: "vocation", entityId: { in: otherPlayerVocationIds } },
          select: { entityId: true, extension: true, updatedAt: true },
        })
      : Promise.resolve([]),
  ]);
  const otherPlayerVocationNameById = new Map(otherPlayerVocations.map((v) => [v.id, v.name]));
  const otherPlayerVocationImageById = new Map(otherPlayerVocationImages.map((img) => [img.entityId, img]));

  const itemIdByPid = new Map(
    equippedItems.map((row) => [row.pid, row.itemtype]),
  );
  const itemIds = Array.from(new Set(equippedItems.map((row) => row.itemtype)));

  const [items, images] = await Promise.all([
    itemIds.length
      ? prisma.item.findMany({
          where: { id: { in: itemIds } },
          select: {
            id: true,
            name: true,
            description: true,
            weight: true,
            skills: true,
            lookTypeId: true,
          },
        })
      : Promise.resolve([]),
    itemIds.length
      ? prisma.entityImage.findMany({
          where: { entityType: "item", entityId: { in: itemIds } },
          select: { entityId: true, extension: true, updatedAt: true },
        })
      : Promise.resolve([]),
  ]);
  const itemById = new Map(items.map((item) => [item.id, item]));
  const imageByItemId = new Map(images.map((image) => [image.entityId, image]));

  const lookTypeIds = Array.from(
    new Set(items.map((item) => item.lookTypeId).filter((id): id is number => id != null)),
  );
  const looktypes = lookTypeIds.length
    ? await prisma.looktype.findMany({
        where: { id: { in: lookTypeIds } },
        select: { id: true, frameCount: true, frameDurationsMs: true, updatedAt: true },
      })
    : [];
  const looktypeById = new Map(looktypes.map((lt) => [lt.id, lt]));

  const equipment = Object.fromEntries(
    EQUIPMENT_SLOTS.map(({ pid, key }) => {
      const itemId = itemIdByPid.get(pid);
      if (itemId == null) return [key, null];

      const item = itemById.get(itemId);
      const image = imageByItemId.get(itemId);
      const looktype = item?.lookTypeId != null ? looktypeById.get(item.lookTypeId) : undefined;
      const skills = (item?.skills as Record<string, number> | null) ?? {};
      return [
        key,
        {
          itemId,
          name: item?.name ?? `Item ${itemId}`,
          description: item?.description ?? "",
          weight: item?.weight ?? 0,
          skills: Object.fromEntries(
            Object.entries(skills).filter(([, value]) => value),
          ),
          image: image
            ? { extension: image.extension, updatedAt: image.updatedAt }
            : null,
          looktype: looktype
            ? {
                id: looktype.id,
                frameCount: looktype.frameCount,
                frameDurationsMs: looktype.frameDurationsMs as number[],
                updatedAt: looktype.updatedAt,
              }
            : null,
        },
      ];
    }),
  );

  const CRYSTAL_COIN_GP_VALUE = 10_000; // 1 crystal = 100 platinum = 10.000 gold; `balance` está em gp.

  return NextResponse.json({
    player: {
      ...player,
      vocationName: vocation?.name ?? "Desconhecida",
      vocationImage: vocationImage
        ? { extension: vocationImage.extension, updatedAt: vocationImage.updatedAt }
        : null,
      experience: player.experience.toString(),
      townName: town?.name ?? "Desconhecido",
      rankPositionLevel: rankByLevel,
      rankPositionResets: rankByResets,
      balanceCrystalCoins: Math.floor(player.balance / CRYSTAL_COIN_GP_VALUE),
      donationCount,
      donateTier: { key: donateTier.key, name: donateTier.name, bonusPct: donateTier.bonusPct },
      infiniteBless: donateTier.bonusPct > 0,
      resetAverage,
      accountGroupId: account?.groupId ?? 0,
      guild: rank
        ? { id: rank.guild.id, name: rank.guild.name, rank: rank.name }
        : null,
      equipment,
      otherCharacters: otherPlayers.map((p) => ({
        id: p.id,
        name: p.name,
        level: p.level,
        resets: p.resets,
        online: p.online,
        vocation: p.vocation,
        vocationName: otherPlayerVocationNameById.get(p.vocation) ?? "Desconhecida",
        vocationImage: (() => {
          const img = otherPlayerVocationImageById.get(p.vocation);
          return img ? { extension: img.extension, updatedAt: img.updatedAt } : null;
        })(),
      })),
    },
  });
}
