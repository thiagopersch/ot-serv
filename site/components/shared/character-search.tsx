"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CharacterProfile } from "@/components/shared/character-profile/character-profile";

export function CharacterSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialName = searchParams.get("nome") ?? "";
  const [query, setQuery] = useState(initialName);
  const [searchedName, setSearchedName] = useState(initialName);

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      setSearchedName(trimmed);
      router.replace(`/community/characters?nome=${encodeURIComponent(trimmed)}`, {
        scroll: false,
      });
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={handleSearch} className="mx-auto flex w-full max-w-xl gap-2">
        <Input
          placeholder="Nome do personagem"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button type="submit">
          <Search className="size-4" />
          Buscar
        </Button>
      </form>

      {searchedName && <CharacterProfile key={searchedName} name={searchedName} />}
    </div>
  );
}
