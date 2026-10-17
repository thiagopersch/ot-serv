import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import type { Prisma } from "@/lib/generated/prisma/client";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const POST = withAudit(async function POST(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const source = await prisma.spell.findUnique({ where: { id: Number(id) } });

  if (!source) {
    return NextResponse.json({ error: "Spell não encontrada." }, { status: 404 });
  }

  const name = `${source.name} (cópia)`;
  const { id: _id, name: _name, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = source;
  void _id;
  void _name;
  void _createdAt;
  void _updatedAt;

  const spell = await prisma.spell.create({
    data: { ...rest, name } as Prisma.SpellUncheckedCreateInput,
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "duplicate",
    entity: "spell",
    entityId: spell.id,
    metadata: { sourceId: source.id, name: spell.name },
  });

  return NextResponse.json({ id: spell.id, name: spell.name }, { status: 201 });
});
