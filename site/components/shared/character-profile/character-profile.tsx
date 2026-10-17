"use client";

import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import { Skeleton } from "@/components/ui/skeleton";
import { CharacterProfileHeader } from "./character-profile-header";
import { CharacterProfileTabs } from "./character-profile-tabs";
import type { CharacterDetail } from "./types";

export function CharacterProfile({ name }: { name: string }) {
  const { data, isLoading } = useSWR<{ player?: CharacterDetail; error?: string }>(
    `/api/public/characters/${encodeURIComponent(name)}`,
    fetcher,
  );

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <Skeleton className="h-32 w-full" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-24" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data?.player) {
    return <p className="text-center text-muted-foreground">Nenhum personagem encontrado com esse nome.</p>;
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <CharacterProfileHeader player={data.player} />
      <CharacterProfileTabs name={name} player={data.player} />
    </div>
  );
}
