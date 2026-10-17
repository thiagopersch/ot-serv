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
    select: { id: true, level: true },
  });

  if (!player) {
    return NextResponse.json({ error: "Personagem não encontrado." }, { status: 404 });
  }

  const [quests, playerQuests] = await Promise.all([
    prisma.quest.findMany({
      where: { published: true, levelRequired: { lte: player.level } },
      orderBy: { levelRequired: "asc" },
    }),
    prisma.playerQuest.findMany({ where: { playerId: player.id } }),
  ]);

  const playerQuestByQuestId = new Map(playerQuests.map((pq) => [pq.questId, pq]));

  const questsByCategory = Object.groupBy(
    quests.map((quest) => {
      const playerQuest = playerQuestByQuestId.get(quest.id);
      return {
        id: quest.id,
        name: quest.name,
        description: quest.description,
        category: quest.category,
        imageUrl: quest.imageUrl,
        completed: playerQuest?.completed ?? false,
        rewarded: playerQuest?.rewarded ?? false,
      };
    }),
    (quest) => quest.category,
  );

  return NextResponse.json({ questsByCategory });
}
