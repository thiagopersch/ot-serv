"use client";

import { useState } from "react";
import useSWR from "swr";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { CheckSquare, Plus } from "lucide-react";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import {
  ITEM_TYPES,
  SLOT_TYPES,
  WEAPON_TYPES,
} from "@/lib/validations/admin/item";
import { useServerTable } from "@/hooks/use-server-table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/shared/data-table";
import { EntityThumb } from "@/components/shared/entity-thumb";
import { useEntityImages } from "@/components/shared/use-entity-images";
import { BackToListButton } from "@/components/shared/back-to-list-button";
import type { FilterFieldConfig } from "@/components/shared/advanced-filter-panel";

type ItemPickerRow = {
  id: number;
  name: string;
  type: string;
  weaponType: string;
  slotType: string;
};

/** Preliminar do cadastro de itens — só os campos relevantes pra escolher itens no autoloot. */
const PICKER_FIELDS: FilterFieldConfig[] = [
  {
    key: "type",
    label: "Tipo",
    type: "select",
    options: ITEM_TYPES.filter(Boolean).map((type) => ({ value: type, label: type })),
  },
  {
    key: "weaponType",
    label: "Weapon type",
    type: "select",
    options: WEAPON_TYPES.filter(Boolean).map((type) => ({ value: type, label: type })),
  },
  {
    key: "slotType",
    label: "Slot type",
    type: "select",
    options: SLOT_TYPES.filter(Boolean).map((slot) => ({ value: slot, label: slot })),
  },
  {
    key: "published",
    label: "Publicado",
    type: "select",
    options: [
      { value: "true", label: "Publicado" },
      { value: "false", label: "Não publicado" },
    ],
  },
  { key: "idMin", label: "ID mínimo", type: "number" },
  { key: "idMax", label: "ID máximo", type: "number" },
  {
    key: "hasImage",
    label: "Possui imagem",
    type: "select",
    options: [
      { value: "true", label: "Sim" },
      { value: "false", label: "Não" },
    ],
  },
];

const BULK_BATCH_SIZE = 200;

/** Lê o erro de uma resposta da API de forma robusta — primeiro JSON, depois texto puro, com o
 * status HTTP como fallback. Evita o "Não foi possível salvar." sem contexto. */
async function readApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (typeof body?.error === "string" && body.error) return body.error;
  } catch {
    // corpo não-JSON — tenta texto puro abaixo
  }
  try {
    const text = await response.text();
    if (text) return `Erro ${response.status}: ${text.slice(0, 300)}`;
  } catch {
    // sem corpo legível — usa o fallback abaixo
  }
  return `Não foi possível salvar (HTTP ${response.status}).`;
}

export default function AdminAutolootItemsNewPage() {
  const table = useServerTable();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [published, setPublished] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtros são opcionais ("Todos" = sem filtro); a busca já vem com debounce do useServerTable.
  const { data, isLoading, isValidating } = useSWR<PaginatedResult<ItemPickerRow>>(
    `/api/admin/items?${table.buildQueryParams().toString()}`,
    fetcher,
  );

  const items = data?.data ?? [];
  const images = useEntityImages("item", items.map((item) => item.id));
  const selectedCount = Object.keys(rowSelection).length;

  async function handleAddToAutoloot() {
    const selectedIds = Object.entries(rowSelection)
    .filter(([, selected]) => selected)
    .map(([id]) => Number(id))
    .sort((a, b) => a - b);

    if (selectedIds.length === 0) {
      toast.error("Selecione ao menos um item.");
      return;
    }

    const batches: number[][] = [];
    for (let i = 0; i < selectedIds.length; i += BULK_BATCH_SIZE) {
      batches.push(selectedIds.slice(i, i + BULK_BATCH_SIZE));
    }

    setIsSubmitting(true);
    let createdTotal = 0;
    let skippedTotal = 0;
    try {
      for (const batch of batches) {
        const response = await fetch("/api/admin/autoloot-items/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // O nome é resolvido no servidor a partir do cadastro de itens.
            items: batch.map((id) => ({ itemId: id })),
            published,
          }),
        });

        if (!response.ok) {
          toast.error(await readApiError(response));
          return;
        }

        const body = (await response.json()) as { created: unknown[]; skipped: number[] };
        createdTotal += body.created.length;
        skippedTotal += body.skipped.length;
      }

      toast.success(`${createdTotal} item(ns) adicionado(s) ao autoloot.`);
      if (skippedTotal > 0) {
        toast.info(`${skippedTotal} item(ns) já estavam na lista e foram ignorados.`);
      }
      setRowSelection({});
    } finally {
      setIsSubmitting(false);
    }
  }

  const columns: ColumnDef<ItemPickerRow>[] = [
    {
      id: "image",
      header: "Imagem",
      cell: ({ row }) => (
        <EntityThumb
          entityType="item"
          id={row.original.id}
          name={row.original.name}
          image={images.get(row.original.id) ?? null}
        />
      ),
    },
    { accessorKey: "id", header: "ID" },
    { accessorKey: "name", header: "Nome" },
    {
      accessorKey: "type",
      header: "Tipo",
      cell: ({ row }) => row.original.type || "-",
    },
    {
      accessorKey: "weaponType",
      header: "Weapon type",
      cell: ({ row }) => row.original.weaponType || "-",
    },
    {
      accessorKey: "slotType",
      header: "Slot type",
      cell: ({ row }) => row.original.slotType || "-",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/autoloot-items" />
      <div>
        <h1 className="text-2xl font-semibold">Adicionar itens ao autoloot</h1>
        <p className="text-muted-foreground">
          Busque por nome/ID ou use os filtros avançados (opcionais), marque os itens desejados e
          adicione em lote à lista do autoloot.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={items}
        isLoading={isLoading}
        isFiltering={!isLoading && isValidating}
        searchPlaceholder="Buscar por nome ou ID..."
        searchValue={table.searchInput}
        onSearchChange={table.handleSearchChange}
        filters={PICKER_FIELDS}
        filterValues={table.draftFilters}
        onFilterValuesChange={table.setDraftFilters}
        onApplyFilters={table.applyFilters}
        onClearFilters={table.clearFilters}
        enableRowSelection
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        getRowId={(row) => String(row.id)}
        manualPagination
        pageIndex={table.pageIndex}
        pageSize={table.pageSize}
        pageCount={data?.pageCount ?? 1}
        totalCount={data?.total}
        onPageChange={table.setPageIndex}
        onPageSizeChange={table.setPageSize}
      />

      {/* Painel fixo de seleção — sobrevive à troca de página graças à `RowSelectionState` externa. */}
      <div className="sticky bottom-4 flex flex-wrap items-center gap-3 rounded-md border bg-background/95 p-3 shadow-sm backdrop-blur">
        <CheckSquare className="size-4 text-muted-foreground" />
        <span className="text-sm">
          <strong>{selectedCount}</strong> item(ns) selecionado(s)
        </span>

        <div className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={published}
            onChange={(event) => setPublished(event.target.checked)}
          />
          <Label className="font-normal">Publicado (disponível no autoloot)</Label>
        </div>

        <Button
          type="button"
          className="ml-auto"
          disabled={isSubmitting || selectedCount === 0}
          onClick={handleAddToAutoloot}
        >
          <Plus className="size-4" />
          {isSubmitting ? "Adicionando..." : `Adicionar ${selectedCount} ao autoloot`}
        </Button>
      </div>
    </div>
  );
}