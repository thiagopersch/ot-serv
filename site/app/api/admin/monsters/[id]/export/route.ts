import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { fetchWordsBySpellId, monsterRowToFormInput } from "@/lib/monster-mapper";
import { monsterFileName, monsterToXml } from "@/lib/monster-xml";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const GET = withAudit(async function GET(_request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const monster = await prisma.monster.findUnique({ where: { id: Number(id) } });

  if (!monster) {
    return NextResponse.json({ error: "Monstro não encontrado." }, { status: 404 });
  }

  const formInput = monsterRowToFormInput(monster);
  const wordsBySpellId = await fetchWordsBySpellId(prisma, formInput);

  const [looktype, universe] = await Promise.all([
    monster.lookTypeId != null
      ? prisma.looktype.findUnique({ where: { id: monster.lookTypeId } })
      : null,
    monster.universeId != null
      ? prisma.universe.findUnique({ where: { id: monster.universeId } })
      : null,
  ]);

  const xml = monsterToXml(formInput, wordsBySpellId, looktype?.looktypeNumber ?? null, universe?.name ?? null);

  return new Response(xml + "\n", {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${monsterFileName(monster.name)}"`,
    },
  });
});
