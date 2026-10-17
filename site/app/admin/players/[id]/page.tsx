import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { playerToFormInput } from "@/lib/player-mapper";
import { PlayerForm } from "@/components/admin/players/player-form";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Editar jogador",
};

export default async function EditPlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const player = await prisma.player.findUnique({ where: { id: Number(id) } });

  if (!player) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/players" />
      <div>
        <h1 className="text-2xl font-semibold">Editar jogador: {player.name}</h1>
        <p className="text-muted-foreground">Altere os dados do personagem.</p>
      </div>
      <PlayerForm
        playerId={player.id}
        initialValues={playerToFormInput(player)}
        readOnly={{
          lastlogin: player.lastlogin,
          lastip: player.lastip,
          lastlogout: player.lastlogout,
          stamina: player.stamina.toString(),
          createdAt: player.createdAt.toISOString(),
        }}
      />
    </div>
  );
}
