import type { Player } from "@/lib/generated/prisma/client";
import type { PlayerUpdateInput } from "@/lib/validations/admin/player";

function parseUnlockedVocations(value: string): number[] {
  return [...value.matchAll(/\d+/g)].map((match) => Number(match[0]));
}

function serializeUnlockedVocations(ids: number[]): string {
  return ids.join(",");
}

export function playerToFormInput(player: Player): PlayerUpdateInput {
  return {
    name: player.name,
    worldId: player.worldId,
    accountId: player.accountId,
    groupId: player.groupId,
    rankId: player.rankId,
    vocation: player.vocation,
    sex: player.sex,
    level: player.level,
    online: player.online,
    save: player.save,
    deleted: player.deleted,

    health: player.health,
    healthmax: player.healthmax,
    mana: player.mana,
    manamax: player.manamax,
    cap: player.cap,
    soul: player.soul,
    maglevel: player.maglevel,
    experience: Number(player.experience),
    manaspent: Number(player.manaspent),
    resets: player.resets,
    skillPoints: player.skillPoints,

    townId: player.townId,
    posx: player.posx,
    posy: player.posy,
    posz: player.posz,
    direction: player.direction,

    healthSkill: player.healthSkill,
    manaSkill: player.manaSkill,
    bendSkill: player.bendSkill,
    dodgeSkill: player.dodgeSkill,
    dodge: player.dodge,
    critical: player.critical,

    lossExperience: player.lossExperience,
    lossMana: player.lossMana,
    lossSkills: player.lossSkills,
    lossContainers: player.lossContainers,
    lossItems: player.lossItems,
    skull: player.skull,
    skulltime: player.skulltime,
    blessings: player.blessings,
    marriage: player.marriage,
    promotion: player.promotion,

    lookbody: player.lookbody,
    lookfeet: player.lookfeet,
    lookhead: player.lookhead,
    looklegs: player.looklegs,
    looktype: player.looktype,
    lookaddons: player.lookaddons,
    lookmount: player.lookmount,
    lookwings: player.lookwings,
    lookaura: player.lookaura,
    lookshader: player.lookshader,
    lookhealthbar: player.lookhealthbar,
    lookmanabar: player.lookmanabar,

    guildnick: player.guildnick,
    cast: player.cast,
    castViewers: player.castViewers,
    castDescription: player.castDescription,

    unlockedVocations: parseUnlockedVocations(player.unlockedVocations),

    balance: player.balance,
    premend: player.premend,
    description: player.description,
    age: player.age,
    ageMinutes: player.ageMinutes,
    onlineTime: player.onlineTime,
  };
}

export function playerFormToPrismaData(input: PlayerUpdateInput) {
  const { unlockedVocations, experience, manaspent, ...rest } = input;

  return {
    ...rest,
    experience: BigInt(experience),
    manaspent: BigInt(manaspent),
    unlockedVocations: serializeUnlockedVocations(unlockedVocations),
  };
}
