import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const POST = withAudit(async function POST(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const source = await prisma.quest.findUnique({ where: { id: Number(id) } });

  if (!source) {
    return NextResponse.json({ error: "Quest não encontrada." }, { status: 404 });
  }

  const quest = await prisma.quest.create({
    data: {
      name: `${source.name} (cópia)`,
      description: source.description,
      category: source.category,
      categoryId: source.categoryId,
      levelRequired: source.levelRequired,
      rewardExp: source.rewardExp,
      rewardMoney: source.rewardMoney,
      rewardItemId: source.rewardItemId,
      rewardItemCount: source.rewardItemCount,
      rewardItems: source.rewardItems as Prisma.InputJsonValue,
      imageUrl: source.imageUrl,
      published: false,
    },
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "duplicate",
    entity: "quest",
    entityId: quest.id,
    metadata: { sourceId: source.id, name: quest.name },
  });

  return NextResponse.json({ id: quest.id, name: quest.name }, { status: 201 });
});
