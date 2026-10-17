"use client";

import useSWR from "swr";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import type { Ban } from "@/lib/generated/prisma/client";
import type { PaginatedResult } from "@/lib/pagination";
import { BAN_TYPES } from "@/lib/validations/admin/ban";
import { useServerTable } from "@/hooks/use-server-table";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { BanFormDialog } from "@/components/admin/bans/ban-form-dialog";
import { getBanColumns } from "@/components/admin/bans/columns";
import type { FilterFieldConfig } from "@/components/shared/advanced-filter-panel";

const YES_NO_OPTIONS = [
  { value: "true", label: "Sim" },
  { value: "false", label: "Não" },
];

const filterFields: FilterFieldConfig[] = [
  {
    key: "type",
    label: "Tipo",
    type: "select",
    options: BAN_TYPES.map((type) => ({ value: String(type.value), label: type.label })),
  },
  { key: "active", label: "Ativo", type: "select", options: YES_NO_OPTIONS },
  {
    key: "expiresState",
    label: "Expiração",
    type: "select",
    options: [
      { value: "permanent", label: "Permanente" },
      { value: "active", label: "Ainda válido" },
      { value: "expired", label: "Expirado" },
    ],
  },
];

export default function AdminBansPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating, mutate } = useSWR<PaginatedResult<Ban>>(
    `/api/admin/bans?${table.buildQueryParams().toString()}`,
    fetcher
  );

  async function handleDelete(id: number) {
    const response = await fetch(`/api/admin/bans/${id}`, { method: "DELETE" });

    if (!response.ok) {
      toast.error("Não foi possível remover o banimento.");
      return;
    }

    toast.success("Banimento removido.");
    mutate();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Banimentos</h1>
          <p className="text-muted-foreground">Gerencie a tabela `bans`.</p>
        </div>
        <BanFormDialog
          onSaved={() => mutate()}
          trigger={
            <Button>
              <Plus className="size-4" />
              Novo banimento
            </Button>
          }
        />
      </div>

      <DataTable
        columns={getBanColumns(() => mutate(), handleDelete)}
        data={data?.data ?? []}
        isLoading={isLoading}
        isFiltering={!isLoading && isValidating}
        searchPlaceholder="Buscar por valor..."
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
