"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { PencilLine, Plus } from "lucide-react";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import type { AutolootItem } from "@/lib/generated/prisma/client";
import type { PaginatedResult } from "@/lib/pagination";
import { useServerTable } from "@/hooks/use-server-table";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { RowActionsMenu, DeleteRowMenuItem } from "@/components/shared/row-actions-menu";
import { EntityThumb } from "@/components/shared/entity-thumb";
import type { FilterFieldConfig } from "@/components/shared/advanced-filter-panel";
import { BulkEditAutolootDialog } from "@/components/admin/autoloot-items/bulk-edit-autoloot-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AUTOLOOT_CATEGORIES,
  AUTOLOOT_CATEGORY_LABELS,
  type AutolootCategory,
} from "@/lib/validations/admin/autoloot-item";

/** Valor sentinela do Select para "sem tipo forçado" (`category = ""` no banco). */
const AUTO_CATEGORY = "auto";

const CATEGORY_OPTIONS = [
  { value: AUTO_CATEGORY, label: "Automático (items.xml)" },
  ...AUTOLOOT_CATEGORIES.map((category) => ({
    value: category,
    label: AUTOLOOT_CATEGORY_LABELS[category],
  })),
];

function categoryLabel(value: string): string {
  return CATEGORY_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

const filterFields: FilterFieldConfig[] = [
  {
    key: "category",
    label: "Tipo",
    type: "select",
    options: CATEGORY_OPTIONS,
  },
  {
    key: "hasImage",
    label: "Possui imagem",
    type: "select",
    options: [
      { value: "true", label: "Sim" },
      { value: "false", label: "Não" },
    ],
  },
  {
    key: "published",
    label: "Publicado",
    type: "select",
    options: [
      { value: "true", label: "Sim" },
      { value: "false", label: "Não" },
    ],
  },
];

export default function AdminAutolootItemsPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating, mutate } = useSWR<PaginatedResult<AutolootItem>>(
    `/api/admin/autoloot-items?${table.buildQueryParams().toString()}`,
    fetcher,
  );

  // Seleção que atravessa páginas — mesmo padrão do CRUD de itens (app/admin/items/page.tsx):
  // a tabela só recebe/altera a fatia do conjunto que corresponde à página atual.
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);

  const rowSelectionForCurrentPage = useMemo(() => {
    const map: RowSelectionState = {};
    for (const row of data?.data ?? []) if (selectedIds.has(row.id)) map[String(row.id)] = true;
    return map;
  }, [data, selectedIds]);

  function handleRowSelectionChange(
    updater: RowSelectionState | ((old: RowSelectionState) => RowSelectionState),
  ) {
    const next = typeof updater === "function" ? updater(rowSelectionForCurrentPage) : updater;
    setSelectedIds((current) => {
      const merged = new Set(current);
      for (const row of data?.data ?? []) {
        if (next[String(row.id)]) merged.add(row.id);
        else merged.delete(row.id);
      }
      return merged;
    });
  }

  async function handleDelete(id: number) {
    const response = await fetch(`/api/admin/autoloot-items/${id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Não foi possível remover.");
      return;
    }
    toast.success("Item removido do autoloot.");
    mutate();
  }

  async function handleCategoryChange(item: AutolootItem, value: string) {
    const category = value === AUTO_CATEGORY ? "" : (value as AutolootCategory);
    if (category === item.category) return;

    const response = await fetch(`/api/admin/autoloot-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category }),
    });
    if (!response.ok) {
      toast.error("Não foi possível alterar o tipo.");
      return;
    }
    toast.success(`Tipo de "${item.name}" alterado para ${categoryLabel(value)}.`);
    mutate();
  }

  const columns: ColumnDef<AutolootItem>[] = [
    {
      id: "image",
      header: "Imagem",
      cell: ({ row }) => <EntityThumb entityType="item" id={row.original.itemId} />,
    },
    { accessorKey: "name", header: "Nome" },
    { accessorKey: "itemId", header: "Item ID" },
    {
      accessorKey: "category",
      header: "Tipo",
      cell: ({ row }) => {
        const value = row.original.category || AUTO_CATEGORY;
        return (
          <Select
            value={value}
            onValueChange={(next) => {
              if (next) void handleCategoryChange(row.original, next);
            }}
          >
            <SelectTrigger size="sm" className="w-72">
              <SelectValue>{(current: string | null) => categoryLabel(current ?? value)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      },
    },
    {
      accessorKey: "published",
      header: "Publicado",
      cell: ({ row }) => (row.original.published ? "Sim" : "Não"),
    },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => (
        <RowActionsMenu>
          <DeleteRowMenuItem
            title="Remover"
            description="Remove o item da lista de autoloot disponível."
            confirmLabel="Remover"
            onConfirm={() => handleDelete(row.original.id)}
          />
        </RowActionsMenu>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Itens do Autoloot</h1>
        <p className="text-muted-foreground">
          Catálogo de itens que podem ser coletados automaticamente — nem todo item do jogo
          entra aqui, só os publicados aparecem no module do OTC.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isFiltering={!isLoading && isValidating}
        searchPlaceholder="Buscar por nome ou ID..."
        searchValue={table.searchInput}
        onSearchChange={table.handleSearchChange}
        filters={filterFields}
        filterValues={table.draftFilters}
        onFilterValuesChange={table.setDraftFilters}
        onApplyFilters={table.applyFilters}
        onClearFilters={table.clearFilters}
        manualPagination
        pageIndex={table.pageIndex}
        pageSize={table.pageSize}
        pageCount={data?.pageCount ?? 1}
        totalCount={data?.total}
        onPageChange={table.setPageIndex}
        onPageSizeChange={table.setPageSize}
        enableRowSelection
        rowSelection={rowSelectionForCurrentPage}
        onRowSelectionChange={handleRowSelectionChange}
        getRowId={(row) => String(row.id)}
        toolbar={
          <>
            {selectedIds.size > 0 && (
              <Button variant="outline" onClick={() => setBulkEditOpen(true)}>
                <PencilLine className="size-4" />
                Editar selecionados ({selectedIds.size})
              </Button>
            )}
            <Button nativeButton={false} render={<Link href="/admin/autoloot-items/new" />}>
              <Plus className="size-4" />
              Novo
            </Button>
          </>
        }
      />

      <BulkEditAutolootDialog
        ids={[...selectedIds]}
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        onSaved={() => {
          setSelectedIds(new Set());
          mutate();
        }}
      />
    </div>
  );
}
