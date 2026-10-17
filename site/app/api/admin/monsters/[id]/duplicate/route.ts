import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { uniqueCopyName } from "@/lib/duplicate-utils";
import type { Prisma } from "@/lib/generated/prisma/client";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const POST = withAudit(async function POST(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const source = await prisma.monster.findUnique({ where: { id: Number(id) } });

  if (!source) {
    return NextResponse.json({ error: "Monstro não encontrado." }, { status: 404 });
  }

  const name = await uniqueCopyName(
    source.name,
    async (candidate) =>
      (await prisma.monster.findUnique({ where: { name: candidate }, select: { id: true } })) != null,
  );

  const { id: _id, name: _name, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = source;
  void _id;
  void _name;
  void _createdAt;
  void _updatedAt;

  const monster = await prisma.monster.create({
    data: { ...rest, name } as Prisma.MonsterUncheckedCreateInput,
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "duplicate",
    entity: "monster",
    entityId: monster.id,
    metadata: { sourceId: source.id, name: monster.name },
  });

  return NextResponse.json({ id: monster.id, name: monster.name }, { status: 201 });
});
