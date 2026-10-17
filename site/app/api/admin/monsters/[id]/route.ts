import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { monsterFormSchema } from "@/lib/validations/admin/monster";
import { monsterFormToRow, monsterRowToFormInput } from "@/lib/monster-mapper";
import { hasDuplicateName } from "@/lib/unique-name";
import { syncAutolootFromMonsterLoot } from "@/lib/autoloot-sync";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const GET = withAudit(async function GET(_request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const monster = await prisma.monster.findUnique({
    where: { id: Number(id) },
    include: { spells: { select: { spellId: true } } },
  });

  if (!monster) {
    return NextResponse.json({ error: "Monstro não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ monster: monsterRowToFormInput(monster) });
});

export const PATCH = withAudit(async function PATCH(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const body = await request.json();
  const parsed = monsterFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 422 }
    );
  }

  const existingNames = await prisma.monster.findMany({ select: { id: true, name: true } });
  if (hasDuplicateName(existingNames, parsed.data.name, Number(id))) {
    return NextResponse.json({ error: "Já existe um monstro com esse nome." }, { status: 409 });
  }

  const monster = await prisma.monster.update({
    where: { id: Number(id) },
    data: {
      ...monsterFormToRow(parsed.data),
      spells: {
        deleteMany: {},
        create: parsed.data.linkedSpellIds.map((spellId) => ({ spellId })),
      },
    },
    include: { spells: { select: { spellId: true } } },
  });

  await syncAutolootFromMonsterLoot(prisma, parsed.data.loot);

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "monster",
    entityId: monster.id,
    metadata: { name: monster.name },
  });

  return NextResponse.json({ monster: monsterRowToFormInput(monster) });
});

export const DELETE = withAudit(async function DELETE(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  await prisma.monster.delete({ where: { id: Number(id) } });

  await logAudit({
    accountId: Number(session.user.id),
    action: "delete",
    entity: "monster",
    entityId: id,
  });

  return NextResponse.json({ success: true });
});
