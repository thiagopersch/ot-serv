import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const GET = withAudit(async function GET(_request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const looktypeId = Number(id);

  const looktype = await prisma.looktype.findUnique({ where: { id: looktypeId } });
  if (!looktype) {
    return NextResponse.json({ error: "Looktype não encontrada." }, { status: 404 });
  }

  const [npcs, vocations, monsters, items, spells, outfits, extOutfits] = await Promise.all([
    prisma.npc.findMany({ where: { lookTypeId: looktypeId }, select: { id: true, name: true } }),
    prisma.vocation.findMany({ where: { lookTypeId: looktypeId }, select: { id: true, name: true } }),
    prisma.monster.findMany({ where: { lookTypeId: looktypeId }, select: { id: true, name: true } }),
    prisma.item.findMany({ where: { lookTypeId: looktypeId }, select: { id: true, name: true } }),
    prisma.spell.findMany({ where: { lookTypeId: looktypeId }, select: { id: true, name: true } }),
    prisma.outfitDefinition.findMany({
      where: { OR: [{ maleLooktypeId: looktypeId }, { femaleLooktypeId: looktypeId }] },
      select: { id: true, name: true },
    }),
    prisma.extOutfit.findMany({ where: { looktypeId }, select: { id: true, name: true, kind: true } }),
  ]);

  return NextResponse.json({
    npcs,
    vocations,
    monsters,
    items,
    spells,
    outfits,
    extOutfits: extOutfits.map((entry) => ({ id: entry.id, name: `${entry.name} (${entry.kind})` })),
    total:
      npcs.length +
      vocations.length +
      monsters.length +
      items.length +
      spells.length +
      outfits.length +
      extOutfits.length,
  });
});
