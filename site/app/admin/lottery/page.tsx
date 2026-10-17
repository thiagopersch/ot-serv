"use client";

import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import dayjs from "dayjs";

import { fetcher } from "@/lib/fetcher";
import type { Lottery } from "@/lib/generated/prisma/client";
import type { PaginatedResult } from "@/lib/pagination";
import type { LotteryInput } from "@/lib/validations/admin/lottery";
import { useServerTable } from "@/hooks/use-server-table";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActionsMenu, DeleteRowMenuItem } from "@/components/shared/row-actions-menu";
import { LotteryFormDialog } from "@/components/admin/lottery/lottery-form-dialog";
import { ItemThumbByName } from "@/components/shared/item-thumb-by-name";

export default function AdminLotteryPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating, mutate } = useSWR<PaginatedResult<Lottery>>(
    `/api/admin/lottery?${table.buildQueryParams().toString()}`,
    fetcher
  );

  async function handleDelete(id: number) {
    const response = await fetch(`/api/admin/lottery/${id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Não foi possível remover.");
      return;
    }
    toast.success("Removido.");
    mutate();
  }

  async function createOrUpdate(values: LotteryInput, id?: number) {
    const response = await fetch(id ? `/api/admin/lottery/${id}` : "/api/admin/lottery", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (response.ok) mutate();
    return response.ok;
  }

  const columns: ColumnDef<Lottery>[] = [
    { accessorKey: "name", header: "Jogador" },
    {
      accessorKey: "item",
      header: "Item",
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <ItemThumbByName name={row.original.item} size="32" />
          {row.original.item}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Criado em",
      cell: ({ row }) => dayjs(row.original.createdAt).format("DD/MM/YYYY HH:mm"),
    },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => (
        <RowActionsMenu>
          <LotteryFormDialog
            title="Editar prêmio"
            defaultValues={{ name: row.original.name, item: row.original.item }}
            successMessage="Atualizado com sucesso."
            onSubmit={(values) => createOrUpdate(values, row.original.id)}
            trigger={
              <DropdownMenuItem>
                <Pencil className="size-4" />
                Editar
              </DropdownMenuItem>
            }
          />
          <DeleteRowMenuItem
            title="Remover prêmio"
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Loteria</h1>
          <p className="text-muted-foreground">Prêmios sorteáveis da tabela `lottery`.</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isFiltering={!isLoading && isValidating}
        searchPlaceholder="Buscar prêmio..."
        searchValue={table.searchInput}
        onSearchChange={table.handleSearchChange}
        manualPagination
        pageIndex={table.pageIndex}
        pageSize={table.pageSize}
        pageCount={data?.pageCount ?? 1}
        totalCount={data?.total}
        onPageChange={table.setPageIndex}
        onPageSizeChange={table.setPageSize}
        toolbar={
          <LotteryFormDialog
            title="Novo prêmio"
            defaultValues={{ name: "", item: "" }}
            successMessage="Criado com sucesso."
            onSubmit={(values) => createOrUpdate(values)}
            trigger={
              <Button>
                <Plus className="size-4" />
                Novo prêmio
              </Button>
            }
          />
        }
      />
    </div>
  );
}
