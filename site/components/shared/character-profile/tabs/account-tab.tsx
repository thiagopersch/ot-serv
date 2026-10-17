"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

import { entityImageUrl } from "@/lib/entity-image";
import { isSiteAdmin } from "@/lib/auth-constants";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CharacterDetail, OtherCharacter } from "../types";

function OtherCharacterCard({ character }: { character: OtherCharacter }) {
  const src = character.vocationImage
    ? entityImageUrl(
        "vocation",
        character.vocation,
        character.vocationImage.extension,
        new Date(character.vocationImage.updatedAt),
      )
    : null;

  return (
    <Link
      href={`/community/characters/${encodeURIComponent(character.name)}`}
      className="group flex items-center gap-3 rounded-md border p-3 transition-shadow hover:shadow-[0_0_6px_2px_rgba(255,255,255,0.15)]"
    >
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- sprite pequeno, sem otimização necessária
          <img
            src={src}
            alt={character.vocationName}
            className="size-full object-contain"
            style={{ imageRendering: "pixelated" }}
          />
        ) : (
          <span className="text-xs text-muted-foreground">{character.vocationName.slice(0, 2)}</span>
        )}
      </div>
      <div className="flex flex-col gap-0.5 text-sm">
        <span className="font-medium">{character.name}</span>
        <span className="text-xs text-muted-foreground">
          Level {character.level} / Resets {character.resets}
        </span>
        <span className="flex items-center gap-1 text-xs">
          <span className={`size-1.5 rounded-full ${character.online ? "bg-green-500" : "bg-zinc-500"}`} />
          {character.online ? "Online" : "Offline"}
        </span>
      </div>
    </Link>
  );
}

export function AccountTab({ player }: { player: CharacterDetail }) {
  const { data: session } = useSession();
  const canSeeBonus = isSiteAdmin(session?.user.groupId);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Nível do donate
            <Badge>{player.donateTier.name}</Badge>
            {canSeeBonus && player.donateTier.bonusPct > 0 && (
              <Badge variant="outline">
                +{player.donateTier.bonusPct}% XP e +{player.donateTier.bonusPct}% loot
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="flex flex-col pt-6">
          <div className="flex items-center justify-between border-b py-2 text-sm">
            <span className="text-muted-foreground">Bless infinita</span>
            <span>{player.infiniteBless ? "Sim" : "Não"}</span>
          </div>
          <div className="flex items-center justify-between py-2 text-sm">
            <span className="text-muted-foreground">Balanço</span>
            <span>{player.balanceCrystalCoins.toLocaleString("pt-BR")} crystal coins</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Outros personagens</CardTitle>
        </CardHeader>
        <CardContent>
          {player.otherCharacters.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum outro personagem nesta conta.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {player.otherCharacters.map((character) => (
                <OtherCharacterCard key={character.id} character={character} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
