"use client";

import Link from "next/link";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import { useServerTable } from "@/hooks/use-server-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActionsMenu, DeleteRowMenuItem } from "@/components/shared/row-actions-menu";
import type { FilterFieldConfig } from "@/components/shared/advanced-filter-panel";

type TownRow = {
  id: number;
  name: string;
  templeX: number;
  templeY: number;
  templeZ: number;
  published: boolean;
};

const YES_NO_OPTIONS = [
  { value: "true", label: "Sim" },
  { value: "false", label: "Não" },
];

export default function AdminTownsPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating, mutate } = useSWR<PaginatedResult<TownRow>>(
    `/api/admin/towns?${table.buildQueryParams().toString()}`,
    fetcher
  );

  async function handleDelete(id: number) {
    const response = await fetch(`/api/admin/towns/${id}`, { method: "DELETE" });

    if (!response.ok) {
      toast.error("Não foi possível remover a town.");
      return;
    }

    toast.success("Town removida.");
    mutate();
  }

  const filterFields: FilterFieldConfig[] = [
    { key: "published", label: "Publicada", type: "select", options: YES_NO_OPTIONS },
  ];

  const columns: ColumnDef<TownRow>[] = [
    { accessorKey: "id", header: "ID" },
    { accessorKey: "name", header: "Nome" },
    {
      id: "temple",
      header: "Temple position",
      cell: ({ row }) =>
        JSON.stringify({ x: row.original.templeX, y: row.original.templeY, z: row.original.templeZ }),
    },
    {
      accessorKey: "published",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.published ? "default" : "secondary"}>
          {row.original.published ? "Publicada" : "Não publicada"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => (
        <RowActionsMenu>
          <DropdownMenuItem render={<Link href={`/admin/towns/${row.original.id}`} />}>
            <Pencil className="size-4" />
            Editar
          </DropdownMenuItem>
          <DeleteRowMenuItem
            title="Remover town"
            description="Esta ação não pode ser desfeita. Players/houses que referenciam este town_id ficarão com um id inválido."
            confirmLabel="Remover"
            onConfirm={() => handleDelete(row.original.id)}
          />
        </RowActionsMenu>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Towns</h1>
          <p className="text-muted-foreground">
            Cidades/locais do mundo — usadas pelo <code>town_id</code> dos players e exibidas em{" "}
            <code>/gameplay/towns</code>.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/admin/towns/new" />}>
          <Plus className="size-4" />
          Nova town
        </Button>
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
      />
    </div>
  );
}
