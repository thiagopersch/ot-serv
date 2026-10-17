"use client";

import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

type SpellOption = { value: number; label: string };

type SpellListRow = { id: number; kind: string; name: string };

/** Combobox de spell única (usado no name de um attack/defense) — busca as spells
 * cadastradas no CRUD de spells e permite vincular pelo `id`, preenchendo `name`
 * automaticamente ao selecionar. Não afeta o XML exportado; é só conveniência/rastreio. */
export function MonsterSpellCombobox({
  value,
  onSelect,
}: {
  value: number | null;
  onSelect: (spell: { id: number; name: string } | null) => void;
}) {
  const { data } = useSWR<PaginatedResult<SpellListRow>>("/api/admin/spells?pageSize=200", fetcher);

  const options: SpellOption[] = (data?.data ?? []).map((spell) => ({
    value: spell.id,
    label: `#${spell.id} — ${spell.name} (${spell.kind})`,
  }));
  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <Combobox
      items={options}
      value={selected}
      onValueChange={(item) => {
        const option = item as SpellOption | null;
        if (!option) {
          onSelect(null);
          return;
        }
        const spell = data?.data.find((row) => row.id === option.value);
        onSelect(spell ? { id: spell.id, name: spell.name } : null);
      }}
      isItemEqualToValue={(a: SpellOption, b: SpellOption) => a.value === b.value}
      itemToStringLabel={(item: SpellOption) => item.label}
    >
      <ComboboxInput placeholder="Vincular spell..." showClear className="w-full" />
      <ComboboxContent>
        <ComboboxEmpty>Nenhuma spell encontrada.</ComboboxEmpty>
        <ComboboxList>
          {(item: SpellOption) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
