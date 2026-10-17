import type { Metadata } from "next";
import { Suspense } from "react";

import { CharacterSearch } from "@/components/shared/character-search";

export const metadata: Metadata = {
  title: "Buscar jogador",
};

export default function CharacterSearchPage() {
  return (
    <div className="px-4 py-12">
      <h1 className="mb-6 text-center text-2xl font-semibold">Buscar jogador</h1>
      <Suspense>
        <CharacterSearch />
      </Suspense>
    </div>
  );
}
