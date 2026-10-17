"use client";

import { useState } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { useController } from "react-hook-form";
import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import { Input } from "@/components/ui/input";
import { FormItem, FormLabel, FormMessage } from "@/components/ui/form";

type SpellOption = { id: number; kind: string; name: string };

type MonsterSpellLinkFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
};

/** Multi-select de spells vinculadas ao monstro (`MonsterSpell`) — espelha
 * `<monster name="X"/>` dentro de `<instant>` no spells.xml (quais monstros podem
 * conjurar aquela spell), independente das listas de attacks/defenses. */
export function MonsterSpellLinkField<T extends FieldValues>({
  control,
  name,
}: MonsterSpellLinkFieldProps<T>) {
  const { field } = useController({ control, name });
  const [search, setSearch] = useState("");

  const { data } = useSWR<PaginatedResult<SpellOption>>("/api/admin/spells?pageSize=200", fetcher);

  const options = data?.data ?? [];
  const filtered = search
    ? options.filter(
        (option) =>
          option.name.toLowerCase().includes(search.toLowerCase()) || String(option.id).includes(search)
      )
    : options;

  const selected: number[] = (field.value as number[] | undefined) ?? [];
  const selectedSet = new Set(selected);

  function toggle(spellId: number) {
    if (selectedSet.has(spellId)) {
      field.onChange(selected.filter((id) => id !== spellId));
    } else {
      field.onChange([...selected, spellId]);
    }
  }

  return (
    <FormItem>
      <FormLabel>Spells vinculadas ({selected.length} selecionada(s))</FormLabel>
      <Input
        placeholder="Buscar spell por nome ou id..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="max-h-64 overflow-auto rounded-md border p-2">
        {filtered.length === 0 && (
          <p className="p-2 text-sm text-muted-foreground">Nenhuma spell encontrada.</p>
        )}
        {filtered.map((option) => (
          <label
            key={option.id}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
          >
            <input
              type="checkbox"
              className="size-4"
              checked={selectedSet.has(option.id)}
              onChange={() => toggle(option.id)}
            />
            <span>
              #{option.id} — {option.name} ({option.kind})
            </span>
          </label>
        ))}
      </div>
      <FormMessage />
    </FormItem>
  );
}
