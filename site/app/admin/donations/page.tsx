"use client";

import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import dayjs from "dayjs";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import type { DonationInput } from "@/lib/validations/admin/donation";
import { getDonateTier } from "@/lib/donate-tier";
import { useServerTable } from "@/hooks/use-server-table";
import { DataTable } from "@/components/shared/data-table";
import { RowActionsMenu, DeleteRowMenuItem } from "@/components/shared/row-actions-menu";
import { Button } from "@/components/ui/button";
import { DonationFormDialog } from "@/components/admin/donations/donation-form-dialog";

type DonationRow = {
  id: number;
  accountId: number;
  amount: string;
  note: string | null;
  createdAt: string;
  account: { name: string };
};

export default function AdminDonationsPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating, mutate } = useSWR<PaginatedResult<DonationRow>>(
    `/api/admin/donations?${table.buildQueryParams().toString()}`,
    fetcher,
  );

  async function handleDelete(id: number) {
    const response = await fetch(`/api/admin/donations/${id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Não foi possível remover.");
      return;
    }
    toast.success("Removido.");
    mutate();
  }

  async function create(values: DonationInput) {
    const response = await fetch("/api/admin/donations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (response.ok) mutate();
    return response.ok;
  }

  const columns: ColumnDef<DonationRow>[] = [
    { accessorKey: "account.name", header: "Conta", cell: ({ row }) => row.original.account.name },
    { accessorKey: "amount", header: "Valor", cell: ({ row }) => `R$ ${row.original.amount}` },
    { accessorKey: "note", header: "Observação", cell: ({ row }) => row.original.note ?? "—" },
    {
      accessorKey: "createdAt",
      header: "Data",
      cell: ({ row }) => dayjs(row.original.createdAt).format("DD/MM/YYYY HH:mm"),
    },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => (
        <RowActionsMenu>
          <DeleteRowMenuItem
            title="Remover doação"
            description="Esta ação não pode ser desfeita e pode afetar o tier de donate da conta."
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
          <h1 className="text-2xl font-semibold">Doações</h1>
          <p className="text-muted-foreground">
            Lançamento manual de doações (tabela `donations`) — não há gateway de pagamento
            integrado. O tier de donate da conta é calculado pela quantidade de lançamentos.
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Referência de tiers: {getDonateTier(0).name} (0-5), Ferro (6-10), Bronze (11-15, +10%),
        Prata (20-25, +15%), Dourado (26-35, +20%), Platina (36-45, +35%), Diamantite (50+, +50%).
      </p>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isFiltering={!isLoading && isValidating}
        searchPlaceholder="Buscar por conta..."
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
          <DonationFormDialog
            title="Nova doação"
            defaultValues={{ accountName: "", amount: 0, note: "" }}
            successMessage="Doação registrada."
            onSubmit={create}
            trigger={<Button>Nova doação</Button>}
          />
        }
      />
    </div>
  );
}
