"use client";

import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import type { Chest } from "@/lib/generated/prisma/client";
import type { PaginatedResult } from "@/lib/pagination";
import { MAX_CHESTS, defaultChestValues, type ChestInput } from "@/lib/validations/admin/chest";
import { useServerTable } from "@/hooks/use-server-table";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActionsMenu, DeleteRowMenuItem } from "@/components/shared/row-actions-menu";
import { DuplicateButton } from "@/components/shared/duplicate-button";
import { EntityThumb } from "@/components/shared/entity-thumb";
import { useItemName } from "@/components/shared/use-item-name";
import type { FilterFieldConfig } from "@/components/shared/advanced-filter-panel";
import { ChestFormDialog } from "@/components/admin/chests/chest-form-dialog";

const filterFields: FilterFieldConfig[] = [
  { key: "keyItem", label: "Item-chave", type: "text", placeholder: "Nome ou ID do item..." },
  { key: "reward", label: "Nome ou ID da recompensa", type: "text", placeholder: "Nome ou ID do item..." },
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

type ChestRow = Chest & { rewards: { itemId: number; count: number }[] };

function ItemThumbCell({ itemId }: { itemId: number }) {
  const name = useItemName(itemId);
  return <EntityThumb entityType="item" id={itemId} name={name ?? undefined} size="32" />;
}

export default function AdminChestsPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating, mutate } = useSWR<PaginatedResult<ChestRow>>(
    `/api/admin/chests?${table.buildQueryParams().toString()}`,
    fetcher,
  );

  // Contagem total (sem busca/filtros) — usada só pra desabilitar o botão "Novo" ao
  // atingir o limite de MAX_CHESTS; `data.total` acima reflete a busca/filtros aplicados.
  const { data: unfilteredData, mutate: mutateUnfiltered } = useSWR<PaginatedResult<ChestRow>>(
    "/api/admin/chests?page=1&pageSize=1",
    fetcher,
  );
  const chestCount = unfilteredData?.total ?? 0;

  async function handleDelete(id: number) {
    const response = await fetch(`/api/admin/chests/${id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Não foi possível remover.");
      return;
    }
    toast.success("Baú removido.");
    mutate();
    mutateUnfiltered();
  }

  async function createOrUpdate(values: ChestInput, id?: number) {
    const response = await fetch(id ? `/api/admin/chests/${id}` : "/api/admin/chests", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (response.ok) {
      mutate();
      mutateUnfiltered();
      return true;
    }

    const data = await response.json().catch(() => null);
    if (data?.error) toast.error(data.error);
    return false;
  }

  const columns: ColumnDef<ChestRow>[] = [
    { accessorKey: "name", header: "Nome" },
    {
      id: "keyItem",
      header: "Item-chave",
      cell: ({ row }) => <ItemThumbCell itemId={row.original.keyItemId} />,
    },
    {
      id: "rewards",
      header: "Recompensas",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.rewards.map((reward, index) => (
            <span key={index} className="flex items-center gap-1">
              <ItemThumbCell itemId={reward.itemId} />
              <span className="text-xs text-muted-foreground">x{reward.count}</span>
            </span>
          ))}
        </div>
      ),
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
          <ChestFormDialog
            title="Editar baú"
            defaultValues={{
              name: row.original.name,
              keyItemId: row.original.keyItemId,
              rewards: row.original.rewards,
              startMonth: row.original.startMonth,
              startYear: row.original.startYear,
              endMonth: row.original.endMonth,
              endYear: row.original.endYear,
              published: row.original.published,
            }}
            successMessage="Atualizado com sucesso."
            onSubmit={(values) => createOrUpdate(values, row.original.id)}
            trigger={
              <DropdownMenuItem>
                <Pencil className="size-4" />
                Editar
              </DropdownMenuItem>
            }
          />
          <DuplicateButton
            endpoint={`/api/admin/chests/${row.original.id}/duplicate`}
            editPathBase="/admin/chests"
            variant="menuitem"
            onDuplicated={() => {
              mutate();
              mutateUnfiltered();
            }}
          />
          <DeleteRowMenuItem
            title="Remover"
            description="Esta ação não pode ser desfeita."
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
        <h1 className="text-2xl font-semibold">Baús</h1>
        <p className="text-muted-foreground">
          Até {MAX_CHESTS} baús exibidos no OTC (1 central + 2 laterais). Cada um exige um
          item-chave para abrir e sorteia 1 recompensa dentre as configuradas. O período de
          vigência de cada baú permite ter uma rotação de prêmios ao longo do tempo — vários
          baús podem ser cadastrados com prêmios diferentes, cada um valendo só no seu período.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isFiltering={!isLoading && isValidating}
        searchPlaceholder="Buscar por nome..."
        searchValue={table.searchInput}
        onSearchChange={table.handleSearchChange}
        filters={filterFields}
        filterValues={table.draftFilters}
        onFilterValuesChange={table.setDraftFilters}
        onApplyFilters={table.applyFilters}
        onClearFilters={table.clearFilters}
        toolbar={
          <ChestFormDialog
            title="Novo baú"
            defaultValues={defaultChestValues}
            successMessage="Criado com sucesso."
            onSubmit={(values) => createOrUpdate(values)}
            trigger={
              <Button disabled={chestCount >= MAX_CHESTS}>
                <Plus className="size-4" />
                Novo
              </Button>
            }
          />
        }
        manualPagination
        pageIndex={table.pageIndex}
        pageSize={table.pageSize}
        pageCount={data?.pageCount ?? 1}
        totalCount={data?.total}
        onPageChange={table.setPageIndex}
        onPageSizeChange={table.setPageSize}
      />
    </div>
  );
}
