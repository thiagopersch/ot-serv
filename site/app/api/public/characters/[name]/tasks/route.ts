import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { ACCOUNT_MANAGER_NAME, PUBLIC_LISTING_GROUP_ID_LIMIT } from "@/lib/public-player-visibility";

type Params = { params: Promise<{ name: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);

  if (decodedName === ACCOUNT_MANAGER_NAME) {
    return NextResponse.json({ error: "Personagem não encontrado." }, { status: 404 });
  }

  const player = await prisma.player.findFirst({
    where: { name: decodedName, deleted: 0, groupId: { lt: PUBLIC_LISTING_GROUP_ID_LIMIT } },
    select: { id: true },
  });

  if (!player) {
    return NextResponse.json({ error: "Personagem não encontrado." }, { status: 404 });
  }

  const [definitions, playerTasks, taskPoints] = await Promise.all([
    prisma.taskDefinition.findMany({
      orderBy: { levelRequired: "asc" },
      include: { post: { select: { slug: true, published: true } } },
    }),
    prisma.playerTask.findMany({ where: { playerId: player.id } }),
    prisma.playerTaskPoints.findUnique({ where: { playerId: player.id } }),
  ]);

  const playerTaskById = new Map(playerTasks.map((t) => [t.taskId, t]));

  const tasks = definitions.map((definition) => {
    const playerTask = playerTaskById.get(definition.id);
    const kills = playerTask?.kills ?? 0;
    const completed = playerTask?.completed ?? false;

    const progressPercent = completed
      ? 100
      : Math.min(100, definition.killsRequired > 0 ? Math.round((kills / definition.killsRequired) * 100) : 0);

    return {
      taskId: definition.id,
      name: definition.name,
      category: definition.category,
      difficulty: definition.difficulty,
      kills,
      killsRequired: definition.killsRequired,
      completed,
      rewarded: playerTask?.rewarded ?? false,
      progressPercent,
      postSlug: definition.post?.published ? definition.post.slug : null,
    };
  });

  const tasksByCategory = Object.groupBy(tasks, (task) => task.category);

  return NextResponse.json({
    points: taskPoints?.points ?? 0,
    totalCompleted: taskPoints?.totalCompleted ?? 0,
    tasksByCategory,
  });
}
