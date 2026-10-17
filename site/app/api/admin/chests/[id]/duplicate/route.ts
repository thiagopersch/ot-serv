import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { MAX_CHESTS } from "@/lib/validations/admin/chest";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const POST = withAudit(async function POST(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const source = await prisma.chest.findUnique({ where: { id: Number(id) } });

  if (!source) {
    return NextResponse.json({ error: "Baú não encontrado." }, { status: 404 });
  }

  const existingCount = await prisma.chest.count();
  if (existingCount >= MAX_CHESTS) {
    return NextResponse.json(
      { error: `O sistema de baús do OTC exibe no máximo ${MAX_CHESTS} baús (1 central + 2 laterais).` },
      { status: 422 },
    );
  }

  const chest = await prisma.chest.create({
    data: {
      name: `${source.name} (cópia)`,
      keyItemId: source.keyItemId,
      rewards: source.rewards as Prisma.InputJsonValue,
      startMonth: source.startMonth,
      startYear: source.startYear,
      endMonth: source.endMonth,
      endYear: source.endYear,
      published: false,
    },
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "duplicate",
    entity: "chest",
    entityId: chest.id,
    metadata: { sourceId: source.id, name: chest.name },
  });

  return NextResponse.json({ id: chest.id, name: chest.name }, { status: 201 });
});
