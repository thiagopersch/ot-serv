"use client";

import { useState } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { useController } from "react-hook-form";
import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import type { SpellVocationInput } from "@/lib/validations/admin/spell";
import { Input } from "@/components/ui/input";
import { FormItem, FormLabel, FormMessage } from "@/components/ui/form";

type VocationOption = { id: number; name: string };

type SpellVocationFieldProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
};

/** Multi-select de vocações (não há componente genérico de multi-select no projeto ainda —
 * construído específico aqui: lista com busca + checkbox, sem abstração prematura). Cada
 * vocação selecionada tem um toggle "Ocultar da descrição", espelhando o atributo opcional
 * `showInDescription` de `<vocation>` no XML (default: mostrar). */
export function SpellVocationField<TFieldValues extends FieldValues>({
  control,
  name,
}: SpellVocationFieldProps<TFieldValues>) {
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

  const selected: SpellVocationInput[] = (field.value as SpellVocationInput[] | undefined) ?? [];
  const selectedByVocationId = new Map(selected.map((entry) => [entry.vocationId, entry]));

  function toggle(vocationId: number) {
    if (selectedByVocationId.has(vocationId)) {
      field.onChange(selected.filter((entry) => entry.vocationId !== vocationId));
    } else {
      field.onChange([...selected, { vocationId, showInDescription: true }]);
    }
  }

  function setShowInDescription(vocationId: number, showInDescription: boolean) {
    field.onChange(
      selected.map((entry) =>
        entry.vocationId === vocationId ? { ...entry, showInDescription } : entry
      )
    );
  }

  return (
    <FormItem>
      <FormLabel>Vocações ({selected.length} selecionada(s))</FormLabel>
      <Input
        placeholder="Buscar vocação por nome ou id..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="max-h-64 overflow-auto rounded-md border p-2">
        {filtered.length === 0 && (
          <p className="p-2 text-sm text-muted-foreground">Nenhuma vocação encontrada.</p>
        )}
        {filtered.map((option) => {
          const entry = selectedByVocationId.get(option.id);
          const isSelected = entry != null;

          return (
            <div
              key={option.id}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
            >
              <label className="flex flex-1 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={isSelected}
                  onChange={() => toggle(option.id)}
                />
                <span>
                  #{option.id} — {option.name}
                </span>
              </label>
              {entry && (
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    className="size-3.5"
                    checked={!entry.showInDescription}
                    onChange={(event) => setShowInDescription(option.id, !event.target.checked)}
                  />
                  Ocultar da descrição
                </label>
              )}
            </div>
          );
        })}
      </div>
      <FormMessage />
    </FormItem>
  );
}
