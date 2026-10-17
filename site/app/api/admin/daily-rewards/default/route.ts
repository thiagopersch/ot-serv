import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { withAudit } from "@/lib/api-audit-wrapper";
import { loadDailyRewardDefault } from "@/lib/daily-reward-generator";
import {
  DAILY_REWARD_RARITIES,
  dailyRewardDefaultSchema,
} from "@/lib/validations/admin/daily-reward-default";

export const GET = withAudit(async function GET() {
  const { response } = await requireAdminSession();
  if (response) return response;

  return NextResponse.json(await loadDailyRewardDefault());
});

/** Substitui o padrão inteiro (pool por raridade, pesos, itens bonus e outfits). */
export const PUT = withAudit(async function PUT(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const parsed = dailyRewardDefaultSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 422 },
    );
  }

  const { weights, daily, bonus } = parsed.data;
  // Só ids que existem no catálogo (um outfit pode ter sido removido com o form aberto).
  const customOutfitIds = (
    await prisma.customOutfit.findMany({
      where: { id: { in: [...new Set(parsed.data.customOutfitIds)] } },
      select: { id: true },
    })
  ).map((outfit) => outfit.id);

  const items = [
    ...DAILY_REWARD_RARITIES.flatMap((rarity) =>
      daily[rarity].map((item) => ({ kind: "daily", rarity, ...item })),
    ),
    ...bonus.map((item) => ({ kind: "bonus", rarity: null, ...item })),
  ];

  await prisma.$transaction([
    prisma.dailyRewardDefaultItem.deleteMany(),
    prisma.dailyRewardDefaultItem.createMany({ data: items }),
    prisma.dailyRewardRarityWeight.deleteMany(),
    prisma.dailyRewardRarityWeight.createMany({
      data: DAILY_REWARD_RARITIES.map((rarity) => ({
        rarity,
        weight: weights[rarity],
      })),
    }),
    prisma.dailyRewardDefaultOutfit.deleteMany(),
    prisma.dailyRewardDefaultOutfit.createMany({
      data: customOutfitIds.map((customOutfitId) => ({ customOutfitId })),
    }),
  ]);

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "daily_rewards_default",
    entityId: "default",
    metadata: {
      itemCount: items.length,
      outfitCount: customOutfitIds.length,
      weights,
    },
  });

  return NextResponse.json({ ok: true });
});
