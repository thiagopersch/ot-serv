"use client";

import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import { useServerTable } from "@/hooks/use-server-table";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import {
  AuditLogDetailsDialog,
  isAuditLogError,
  type AuditLogDetailsRow,
} from "@/components/admin/audit-logs/audit-log-details-dialog";

type AuditLogRow = AuditLogDetailsRow;

function statusVariant(status: number | null): "secondary" | "default" | "destructive" {
  if (status === null) return "secondary";
  if (status >= 400) return "destructive";
  return "default";
}

export default function AdminAuditLogsPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating } = useSWR<PaginatedResult<AuditLogRow>>(
    `/api/admin/audit-logs?${table.buildQueryParams().toString()}`,
    fetcher
  );

  const columns: ColumnDef<AuditLogRow>[] = [
    {
      accessorKey: "createdAt",
      header: "Data",
      cell: ({ row }) => dayjs(row.original.createdAt).format("DD/MM/YYYY HH:mm:ss"),
    },
    {
      id: "account",
      header: "Conta",
      cell: ({ row }) =>
        row.original.accountName ??
        (row.original.accountId != null ? `#${row.original.accountId}` : "—"),
    },
    { accessorKey: "action", header: "Ação" },
    { accessorKey: "entity", header: "Entidade" },
    { accessorKey: "entityId", header: "ID do registro" },
    { accessorKey: "pageName", header: "Página" },
    { accessorKey: "method", header: "Método" },
    {
      id: "result",
      header: "Resultado",
      cell: ({ row }) => (
        <Badge variant={isAuditLogError(row.original) ? "destructive" : "default"}>
          {isAuditLogError(row.original) ? "Erro" : "Sucesso"}
        </Badge>
      ),
    },
    {
      id: "statusCode",
      header: "Status",
      cell: ({ row }) =>
        row.original.statusCode != null ? (
          <Badge variant={statusVariant(row.original.statusCode)}>{row.original.statusCode}</Badge>
        ) : (
          "—"
        ),
    },
    {
      id: "durationMs",
      header: "Duração",
      cell: ({ row }) => (row.original.durationMs != null ? `${row.original.durationMs} ms` : "—"),
    },
    {
      id: "details",
      header: "Detalhes",
      cell: ({ row }) => <AuditLogDetailsDialog {...row.original} />,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Auditoria</h1>
        <p className="text-muted-foreground">Trilha das ações administrativas (somente leitura).</p>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isFiltering={!isLoading && isValidating}
        searchPlaceholder="Buscar por ação..."
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
