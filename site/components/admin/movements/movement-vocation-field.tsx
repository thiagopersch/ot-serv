"use client";

import { useState } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { useController } from "react-hook-form";
import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import type { MovementVocationInput } from "@/lib/validations/admin/movement";
import { Input } from "@/components/ui/input";
import { FormItem, FormLabel, FormMessage } from "@/components/ui/form";

type VocationOption = { id: number; name: string };

/** Multi-select de vocações que podem equipar/desequipar o item (filhos `<vocation id="N"/>`
 * de um `<movevent type="Equip|DeEquip">`) — mesmo padrão de busca+checkbox de
 * `components/admin/spells/spell-vocation-field.tsx`, sem o toggle extra (movements não têm
 * `showInDescription`). */
export function MovementVocationField<TFieldValues extends FieldValues>({
  control,
  name,
}: {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
}) {
  const { field } = useController({ control, name });
  const [search, setSearch] = useState("");

  const { data } = useSWR<PaginatedResult<VocationOption>>("/api/admin/vocations?pageSize=200", fetcher);

  const options = data?.data ?? [];
  const filtered = search
    ? options.filter(
        (option) =>
          option.name.toLowerCase().includes(search.toLowerCase()) || String(option.id).includes(search)
      )
    : options;

  const selected: MovementVocationInput[] = (field.value as MovementVocationInput[] | undefined) ?? [];
  const selectedIds = new Set(selected.map((entry) => entry.vocationId));

  function toggle(vocationId: number) {
    if (selectedIds.has(vocationId)) {
      field.onChange(selected.filter((entry) => entry.vocationId !== vocationId));
    } else {
      field.onChange([...selected, { vocationId }]);
    }
  }

  return (
    <FormItem>
      <FormLabel>Vocações permitidas ({selected.length} selecionada(s), vazio = todas)</FormLabel>
      <Input
        placeholder="Buscar vocação por nome ou id..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="max-h-64 overflow-auto rounded-md border p-2">
        {filtered.length === 0 && (
          <p className="p-2 text-sm text-muted-foreground">Nenhuma vocação encontrada.</p>
        )}
        {filtered.map((option) => (
          <label
            key={option.id}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
          >
            <input
              type="checkbox"
              className="size-4"
              checked={selectedIds.has(option.id)}
              onChange={() => toggle(option.id)}
            />
            <span>
              #{option.id} — {option.name}
            </span>
          </label>
        ))}
      </div>
      <FormMessage />
    </FormItem>
  );
}
