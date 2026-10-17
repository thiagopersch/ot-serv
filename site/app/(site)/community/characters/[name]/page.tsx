import type { Metadata } from "next";

import { CharacterProfile } from "@/components/shared/character-profile/character-profile";

type Params = { params: Promise<{ name: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { name } = await params;
  return { title: `Buscar Jogador - ${decodeURIComponent(name)}` };
}

export default async function CharacterProfilePage({ params }: Params) {
  const { name } = await params;

  return (
    <div className="px-4 py-12">
      <CharacterProfile name={decodeURIComponent(name)} />
    </div>
  );
}
