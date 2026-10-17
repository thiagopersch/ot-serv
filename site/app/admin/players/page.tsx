"use client";

import Link from "next/link";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil } from "lucide-react";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import { getAccountGroupName } from "@/lib/account-groups";
import { useServerTable } from "@/hooks/use-server-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActionsMenu } from "@/components/shared/row-actions-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const SEX_LABELS: Record<number, string> = {
  1: "Masculino",
  2: "Feminino",
};

function formatNumberBR(value: number): string {
  return value.toLocaleString("pt-BR");
}

type UnlockedVocation = { id: number; name: string };

type PlayerRow = {
  id: number;
  name: string;
  level: number;
  experience: number;
  vocation: number;
  vocationName: string;
  groupId: number;
  online: number;
  deleted: number;
  accountId: number;
  sex: number;
  resets: number;
  health: number;
  healthmax: number;
  mana: number;
  manamax: number;
  cap: number;
  townId: number;
  townName: string | null;
  age: number;
  balance: number;
  unlockedVocations: UnlockedVocation[];
};

export default function AdminPlayersPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating } = useSWR<PaginatedResult<PlayerRow>>(
    `/api/admin/players?${table.buildQueryParams().toString()}`,
    fetcher
  );

  const columns: ColumnDef<PlayerRow>[] = [
    { accessorKey: "id", header: "ID" },
    { accessorKey: "name", header: "Nome" },
    {
      id: "accountId",
      header: "Conta",
      cell: ({ row }) => (
        <Link href={`/admin/accounts/${row.original.accountId}`} className="text-primary hover:underline">
          #{row.original.accountId}
        </Link>
      ),
    },
    {
      accessorKey: "groupId",
      header: "Grupo",
      cell: ({ row }) => `${row.original.groupId} — ${getAccountGroupName(row.original.groupId)}`,
    },
    {
      accessorKey: "sex",
      header: "Sexo",
      cell: ({ row }) => SEX_LABELS[row.original.sex] ?? row.original.sex,
    },
    { accessorKey: "level", header: "Level", cell: ({ row }) => formatNumberBR(row.original.level) },
    {
      accessorKey: "vocationName",
      header: "Vocação",
      cell: ({ row }) => row.original.vocationName,
    },
    {
      accessorKey: "online",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.online ? "default" : "secondary"}>
          {row.original.online ? "Online" : "Offline"}
        </Badge>
      ),
    },
    { accessorKey: "resets", header: "Resets", cell: ({ row }) => formatNumberBR(row.original.resets) },
    {
      id: "health",
      header: "Health / Max",
      cell: ({ row }) => `${formatNumberBR(row.original.health)} / ${formatNumberBR(row.original.healthmax)}`,
    },
    {
      id: "mana",
      header: "Mana / Max",
      cell: ({ row }) => `${formatNumberBR(row.original.mana)} / ${formatNumberBR(row.original.manamax)}`,
    },
    { accessorKey: "cap", header: "Capacidade", cell: ({ row }) => formatNumberBR(row.original.cap) },
    {
      accessorKey: "townName",
      header: "Town",
      cell: ({ row }) => row.original.townName ?? row.original.townId,
    },
    { accessorKey: "age", header: "Age", cell: ({ row }) => formatNumberBR(row.original.age) },
    { accessorKey: "balance", header: "Balance", cell: ({ row }) => formatNumberBR(row.original.balance) },
    {
      id: "unlockedVocations",
      header: "Vocações desbloqueadas",
      cell: ({ row }) => {
        const unlocked = row.original.unlockedVocations;
        if (unlocked.length === 0) return <span className="text-muted-foreground">0</span>;

        return (
          <Tooltip>
            <TooltipTrigger className="cursor-default underline decoration-dotted underline-offset-2">
              {unlocked.length}
            </TooltipTrigger>
            <TooltipContent>
              <div className="flex flex-col gap-0.5">
                {unlocked.map((vocation) => (
                  <div key={vocation.id}>
                    {vocation.id} - {vocation.name}
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      accessorKey: "deleted",
      header: "Deletado",
      cell: ({ row }) => (
        <span
          className={
            row.original.deleted
              ? "font-medium text-red-600 dark:text-red-400"
              : "font-medium text-green-600 dark:text-green-400"
          }
        >
          {row.original.deleted ? "Sim" : "Não"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => (
        <RowActionsMenu>
          <DropdownMenuItem render={<Link href={`/admin/players/${row.original.id}`} />}>
            <Pencil className="size-4" />
            Editar
          </DropdownMenuItem>
        </RowActionsMenu>
      ),
    },
  ];

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Jogadores</h1>
          <p className="text-muted-foreground">
            Edite os dados dos personagens. Criação/remoção acontece pelo cliente de jogo.
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
          manualPagination
          pageIndex={table.pageIndex}
          pageSize={table.pageSize}
          pageCount={data?.pageCount ?? 1}
          totalCount={data?.total}
          onPageChange={table.setPageIndex}
          onPageSizeChange={table.setPageSize}
        />
      </div>
    </TooltipProvider>
  );
}
