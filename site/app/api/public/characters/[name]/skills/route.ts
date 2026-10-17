import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { ACCOUNT_MANAGER_NAME, PUBLIC_LISTING_GROUP_ID_LIMIT } from "@/lib/public-player-visibility";
import { SKILL_IDS } from "@/lib/skill-names";
import { DEFAULT_SKILL_CAP, SKILL_CAP_CRITICAL_KEY, SKILL_CAP_DODGE_KEY, getServerConfig } from "@/lib/server-config";

type Params = { params: Promise<{ name: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);

  if (decodedName === ACCOUNT_MANAGER_NAME) {
    return NextResponse.json({ error: "Personagem não encontrado." }, { status: 404 });
  }

  const player = await prisma.player.findFirst({
    where: { name: decodedName, deleted: 0, groupId: { lt: PUBLIC_LISTING_GROUP_ID_LIMIT } },
    select: { id: true, maglevel: true, dodge: true, critical: true },
  });

  if (!player) {
    return NextResponse.json({ error: "Personagem não encontrado." }, { status: 404 });
  }

  const [skillRows, dodgeCap, criticalCap] = await Promise.all([
    prisma.playerSkill.findMany({ where: { playerId: player.id }, select: { skillid: true, value: true } }),
    getServerConfig(SKILL_CAP_DODGE_KEY, DEFAULT_SKILL_CAP),
    getServerConfig(SKILL_CAP_CRITICAL_KEY, DEFAULT_SKILL_CAP),
  ]);

  const valueBySkillId = new Map(skillRows.map((row) => [row.skillid, row.value]));
  const skills = Object.fromEntries(
    Object.entries(SKILL_IDS).map(([key, skillId]) => [key, valueBySkillId.get(skillId) ?? 0]),
  );

  return NextResponse.json({
    skills,
    magic: player.maglevel,
    // "Velocidade de ataque" reflete a skill de Punho (Fist Fighting) neste servidor.
    attackSpeed: skills.fist ?? 0,
    dodge: player.dodge,
    critical: player.critical,
    dodgeCap: Number(dodgeCap),
    criticalCap: Number(criticalCap),
  });
}
