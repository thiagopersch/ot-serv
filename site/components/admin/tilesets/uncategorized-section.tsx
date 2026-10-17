"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

type BrushRef = { id: number; name: string };
type CategoryOption = { id: number; label: string };

const KIND_QUERY: Record<"terrain" | "doodad", string> = {
  terrain: "TERRAIN,TERRAIN_AND_RAW",
  doodad: "DOODAD,DOODAD_AND_RAW",
};

const TITLES: Record<"ground" | "wall" | "doodad", string> = {
  ground: "Grounds sem categoria",
  wall: "Walls sem categoria",
  doodad: "Doodads sem categoria",
};

export function UncategorizedSection({
  brushKind,
  items,
  onAssigned,
}: {
  brushKind: "ground" | "wall" | "doodad";
  items: BrushRef[];
  onAssigned: () => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [category, setCategory] = useState<CategoryOption | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const comboboxKind: "terrain" | "doodad" = brushKind === "doodad" ? "doodad" : "terrain";
  const { data } = useSWR<{ categories: CategoryOption[] }>(
    `/api/admin/tilesets/categories?type=BRUSH&kind=${KIND_QUERY[comboboxKind]}`,
    fetcher
  );
  const options = data?.categories ?? [];

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === items.length ? new Set() : new Set(items.map((i) => i.id))));
  }

  async function handleAssign() {
    if (selected.size === 0) {
      toast.error("Selecione ao menos um brush.");
      return;
    }
    if (!category) {
      toast.error("Selecione a categoria de destino.");
      return;
    }

    setIsSubmitting(true);
    const response = await fetch("/api/admin/tilesets/uncategorized/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brushKind, ids: Array.from(selected), categoryId: category.id }),
    });
    setIsSubmitting(false);
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(body?.error ?? "Não foi possível atribuir a categoria.");
      return;
    }

    toast.success(`${body.count} brush(es) atribuído(s) à categoria "${category.label}".`);
    setSelected(new Set());
    onAssigned();
  }

  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {TITLES[brushKind]} ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={toggleAll}>
            {selected.size === items.length ? "Desmarcar todos" : "Selecionar todos"}
          </Button>

          <div className="min-w-64 flex-1">
            <Combobox
              items={options}
              value={category}
              onValueChange={(item) => setCategory(item as CategoryOption | null)}
              isItemEqualToValue={(a: CategoryOption, b: CategoryOption) => a.id === b.id}
              itemToStringLabel={(item: CategoryOption) => item.label}
            >
              <ComboboxInput placeholder="Categoria de destino..." className="w-full" showClear />
              <ComboboxContent>
                <ComboboxEmpty>Nenhuma categoria encontrada.</ComboboxEmpty>
                <ComboboxList>
                  {(item: CategoryOption) => (
                    <ComboboxItem key={item.id} value={item}>
                      {item.label}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>

          <Button type="button" onClick={handleAssign} disabled={isSubmitting}>
            {isSubmitting ? "Atribuindo..." : `Atribuir selecionados (${selected.size})`}
          </Button>
        </div>

        <div className="grid max-h-64 grid-cols-2 gap-1 overflow-y-auto rounded-md border p-2 sm:grid-cols-3">
          {items.map((item) => (
            <label key={item.id} className="flex items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-muted">
              <input
                type="checkbox"
                className="size-4"
                checked={selected.has(item.id)}
                onChange={() => toggle(item.id)}
              />
              <span className="truncate">{item.name}</span>
            </label>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
