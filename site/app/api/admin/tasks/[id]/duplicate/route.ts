import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

/** Gera um slug livre a partir do slug de origem sufixando `_copy`, `_copy2`, ... — o `id` é a
 * PK (`player_tasks.task_id` aponta pra ele), então precisa ser único. */
async function nextFreeSlug(sourceId: string) {
  let candidate = `${sourceId}_copy`;
  let suffix = 2;

  while (await prisma.taskDefinition.findUnique({ where: { id: candidate } })) {
    candidate = `${sourceId}_copy${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export const POST = withAudit(async function POST(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const source = await prisma.taskDefinition.findUnique({ where: { id } });

  if (!source) {
    return NextResponse.json({ error: "Task não encontrada." }, { status: 404 });
  }

  const newId = await nextFreeSlug(source.id);

  const task = await prisma.taskDefinition.create({
    data: {
      id: newId,
      name: `${source.name} (cópia)`,
      lookType: source.lookType,
      category: source.category,
      categoryId: source.categoryId,
      type: source.type,
      difficulty: source.difficulty,
      levelRequired: source.levelRequired,
      rankRequired: source.rankRequired,
      killsRequired: source.killsRequired,
      points: source.points,
      experience: source.experience,
      money: source.money,
      published: false,
      monsters: source.monsters as Prisma.InputJsonValue,
      rewards: source.rewards as Prisma.InputJsonValue,
      delivery: source.delivery as Prisma.InputJsonValue,
      monsterDetails: source.monsterDetails as Prisma.InputJsonValue,
    },
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "duplicate",
    entity: "task_definition",
    entityId: task.id,
    metadata: { sourceId: source.id, name: task.name },
  });

  return NextResponse.json({ id: task.id, name: task.name }, { status: 201 });
});
