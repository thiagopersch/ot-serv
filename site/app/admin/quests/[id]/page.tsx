import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import type { QuestRewardItem } from "@/lib/validations/admin/quest";
import { EditQuestForm } from "@/components/admin/quests/edit-quest-form";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Editar quest",
};

export default async function EditQuestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quest = await prisma.quest.findUnique({ where: { id: Number(id) } });

  if (!quest) {
    notFound();
  }

  const initialValues = {
    name: quest.name,
    description: quest.description,
    categoryId: quest.categoryId ?? 0,
    levelRequired: quest.levelRequired,
    rewardExp: quest.rewardExp,
    rewardMoney: quest.rewardMoney,
    rewardItems: (quest.rewardItems as QuestRewardItem[] | null) ?? [],
    published: quest.published,
  };

  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/quests" />
      <div>
        <h1 className="text-2xl font-semibold">Editar quest: {quest.name}</h1>
      </div>
      <EditQuestForm questId={quest.id} imageUrl={quest.imageUrl} initialValues={initialValues} />
    </div>
  );
}
