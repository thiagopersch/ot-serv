"use client";

import { useMemo, useState } from "react";
import type { RowSelectionState } from "@tanstack/react-table";

/** Seleção de linhas que atravessa páginas da `DataTable` com paginação no backend (mesmo
 * padrão de `app/admin/looktypes/page.tsx`): guarda os ids num Set e só entrega/altera a fatia
 * da página atual. */
export function useCrossPageSelection<Row extends { id: number }>(rows: Row[] | undefined) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const rowSelection = useMemo(() => {
    const map: RowSelectionState = {};
    for (const row of rows ?? []) if (selectedIds.has(row.id)) map[String(row.id)] = true;
    return map;
  }, [rows, selectedIds]);

  function onRowSelectionChange(
    updater: RowSelectionState | ((old: RowSelectionState) => RowSelectionState),
  ) {
    const next = typeof updater === "function" ? updater(rowSelection) : updater;
    setSelectedIds((current) => {
      const merged = new Set(current);
      for (const row of rows ?? []) {
        if (next[String(row.id)]) merged.add(row.id);
        else merged.delete(row.id);
      }
      return merged;
    });
  }

  return {
    selectedIds,
    rowSelection,
    onRowSelectionChange,
    clearSelection: () => setSelectedIds(new Set()),
  };
}
