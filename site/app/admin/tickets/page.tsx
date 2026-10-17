"use client";

import Link from "next/link";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import { useServerTable } from "@/hooks/use-server-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActionsMenu } from "@/components/shared/row-actions-menu";

type TicketRow = {
  id: number;
  subject: string;
  category: string;
  status: string;
  accountId: number;
  updatedAt: string;
  _count: { messages: number };
};

const statusLabel: Record<string, string> = {
  open: "Aberto",
  answered: "Respondido",
  closed: "Fechado",
};

export default function AdminTicketsPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating } = useSWR<PaginatedResult<TicketRow>>(
    `/api/admin/tickets?${table.buildQueryParams().toString()}`,
    fetcher
  );

  const columns: ColumnDef<TicketRow>[] = [
    { accessorKey: "id", header: "ID" },
    { accessorKey: "subject", header: "Assunto" },
    { accessorKey: "category", header: "Categoria" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.status === "closed" ? "secondary" : "default"}>
          {statusLabel[row.original.status] ?? row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "updatedAt",
      header: "Atualizado em",
      cell: ({ row }) => dayjs(row.original.updatedAt).format("DD/MM/YYYY HH:mm"),
    },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => (
        <RowActionsMenu>
          <DropdownMenuItem render={<Link href={`/admin/tickets/${row.original.id}`} />}>
            Ver
          </DropdownMenuItem>
        </RowActionsMenu>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Tickets</h1>
        <p className="text-muted-foreground">Atendimento de suporte.</p>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isFiltering={!isLoading && isValidating}
        searchPlaceholder="Buscar por assunto..."
        searchValue={table.searchInput}
        onSearchChange={table.handleSearchChange}
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
