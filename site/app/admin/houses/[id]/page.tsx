import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { HouseForm } from "@/components/admin/houses/house-form";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Editar house",
};

export default async function EditHousePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const house = await prisma.house.findFirst({
    where: { id: Number(id) },
    include: {
      houseAuction: { include: { player: { select: { id: true, name: true } } } },
      lists: { select: { listid: true } },
    },
  });

  if (!house) {
    notFound();
  }

  const owner = house.owner > 0 ? await prisma.player.findUnique({ where: { id: house.owner }, select: { name: true } }) : null;

  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/houses" />
      <div>
        <h1 className="text-2xl font-semibold">Editar house: {house.name}</h1>
        <p className="text-muted-foreground">
          House #{house.id}. Criação/remoção acontece pelo mapa (RME); aqui só moderação.
        </p>
      </div>
      <HouseForm
        houseId={house.id}
        initialValues={{
          name: house.name,
          town: house.town,
          owner: house.owner,
          rent: house.rent,
          price: house.price,
          size: house.size,
          paid: house.paid,
          warnings: house.warnings,
          guild: house.guild,
          clear: house.clear,
        }}
        ownerName={owner?.name ?? null}
        auction={
          house.houseAuction
            ? {
                bid: house.houseAuction.bid,
                limit: house.houseAuction.limit,
                endtime: house.houseAuction.endtime,
                player: house.houseAuction.player,
              }
            : null
        }
        listCount={house.lists.length}
      />
    </div>
  );
}
