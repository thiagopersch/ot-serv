import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { isGameServerOnline } from "@/lib/game-server-status";
import { publicPlayerVisibilityWhere } from "@/lib/public-player-visibility";

export async function GET() {
  const [online, onlineCount] = await Promise.all([
    isGameServerOnline(),
    prisma.player.count({
      where: { online: 1, deleted: 0, ...publicPlayerVisibilityWhere() },
    }),
  ]);

  return NextResponse.json({ online, onlineCount });
}
