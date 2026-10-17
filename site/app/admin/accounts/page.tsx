"use client";

import Link from "next/link";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil } from "lucide-react";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import { ACCOUNT_GROUPS, getAccountGroupName } from "@/lib/account-groups";
import { useServerTable } from "@/hooks/use-server-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActionsMenu } from "@/components/shared/row-actions-menu";
import { AccountBlockedToggle } from "@/components/admin/accounts/account-blocked-toggle";
import type { FilterFieldConfig } from "@/components/shared/advanced-filter-panel";

type AccountRow = {
  id: number;
  name: string;
  email: string;
  groupId: number;
  blocked: boolean;
  premdays: number;
  warnings: number;
  _count: { players: number };
};

const YES_NO_OPTIONS = [
  { value: "true", label: "Sim" },
  { value: "false", label: "Não" },
];

const filterFields: FilterFieldConfig[] = [
  {
    key: "groupId",
    label: "Grupo",
    type: "select",
    options: ACCOUNT_GROUPS.map((group) => ({ value: String(group.id), label: `${group.id} — ${group.name}` })),
  },
  {
    key: "premdaysBucket",
    label: "Dias premium",
    type: "select",
    options: [
      { value: "1", label: "Igual à 1 dia" },
      { value: "2-14", label: "2 à 14 dias" },
      { value: "15-30", label: "15 à 30 dias" },
      { value: "30+", label: "+30 dias" },
    ],
  },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "premium", label: "Premium" },
      { value: "free", label: "Free" },
    ],
  },
  { key: "blocked", label: "Bloqueada", type: "select", options: YES_NO_OPTIONS },
];

export default function AdminAccountsPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating, mutate } = useSWR<PaginatedResult<AccountRow>>(
    `/api/admin/accounts?${table.buildQueryParams().toString()}`,
    fetcher
  );

  const columns: ColumnDef<AccountRow>[] = [
    { accessorKey: "id", header: "ID" },
    { accessorKey: "name", header: "Conta" },
    { accessorKey: "email", header: "E-mail" },
    {
      accessorKey: "groupId",
      header: "Grupo",
      cell: ({ row }) => `${row.original.groupId} — ${getAccountGroupName(row.original.groupId)}`,
    },
    { accessorKey: "premdays", header: "Prem days" },
    {
      accessorKey: "blocked",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.blocked ? "destructive" : "default"}>
          {row.original.blocked ? "Bloqueada" : "Ativa"}
        </Badge>
      ),
    },
    {
      id: "blockToggle",
      header: "Bloquear",
      cell: ({ row }) => <AccountBlockedToggle account={row.original} onToggled={() => mutate()} />,
    },
    { accessorFn: (row) => row._count.players, id: "players", header: "Personagens" },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => (
        <RowActionsMenu>
          <DropdownMenuItem render={<Link href={`/admin/accounts/${row.original.id}`} />}>
            <Pencil className="size-4" />
            Editar
          </DropdownMenuItem>
        </RowActionsMenu>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Contas</h1>
        <p className="text-muted-foreground">
          Gerencie nível de acesso, bloqueio e dias premium. Cadastro de novas contas acontece pelo
          formulário público.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isFiltering={!isLoading && isValidating}
        searchPlaceholder="Buscar por conta..."
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
