import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { GuildForm } from "@/components/admin/guilds/guild-form";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Editar guild",
};

export default async function EditGuildPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const guild = await prisma.guild.findUnique({
    where: { id: Number(id) },
    include: {
      owner: { select: { id: true, name: true } },
      ranks: { orderBy: { level: "desc" } },
      wars: { include: { enemy: { select: { id: true, name: true } } } },
      invites: { include: { player: { select: { id: true, name: true } } } },
    },
  });

  if (!guild) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/guilds" />
      <div>
        <h1 className="text-2xl font-semibold">Editar guild: {guild.name}</h1>
        <p className="text-muted-foreground">
          Guild #{guild.id}. Fundação/dissolução acontece pelo cliente de jogo; aqui só moderação.
        </p>
      </div>
      <GuildForm
        guildId={guild.id}
        initialValues={{
          name: guild.name,
          motd: guild.motd,
          ownerId: guild.ownerId,
          ranks: guild.ranks.map((rank) => ({ id: rank.id, name: rank.name, level: rank.level })),
        }}
        ownerName={guild.owner.name}
        wars={guild.wars.map((war) => ({
          id: war.id,
          enemyName: war.enemy.name,
          frags: war.frags,
          guildKills: war.guildKills,
          enemyKills: war.enemyKills,
          status: war.status,
        }))}
        invites={guild.invites.map((invite) => ({ player: invite.player }))}
      />
    </div>
  );
}
