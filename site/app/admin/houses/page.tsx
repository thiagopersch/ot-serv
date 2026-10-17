"use client";

import Link from "next/link";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil } from "lucide-react";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import { useServerTable } from "@/hooks/use-server-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActionsMenu } from "@/components/shared/row-actions-menu";

function formatNumberBR(value: number): string {
  return value.toLocaleString("pt-BR");
}

type HouseRow = {
  id: number;
  worldId: number;
  name: string;
  town: number;
  townName: string | null;
  owner: number;
  ownerName: string | null;
  size: number;
  price: number;
  rent: number;
  paid: number;
  warnings: number;
  guild: boolean;
  clear: boolean;
};

export default function AdminHousesPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating } = useSWR<PaginatedResult<HouseRow>>(
    `/api/admin/houses?${table.buildQueryParams().toString()}`,
    fetcher
  );

  const columns: ColumnDef<HouseRow>[] = [
    { accessorKey: "id", header: "ID" },
    { accessorKey: "name", header: "Nome" },
    {
      accessorKey: "townName",
      header: "Town",
      cell: ({ row }) => row.original.townName ?? row.original.town,
    },
    {
      id: "owner",
      header: "Dono",
      cell: ({ row }) =>
        row.original.owner > 0 ? (
          <Link href={`/admin/players/${row.original.owner}`} className="text-primary hover:underline">
            {row.original.ownerName ?? `#${row.original.owner}`}
          </Link>
        ) : (
          <span className="text-muted-foreground">Sem dono</span>
        ),
    },
    { accessorKey: "size", header: "Tiles", cell: ({ row }) => formatNumberBR(row.original.size) },
    { accessorKey: "rent", header: "Rent", cell: ({ row }) => formatNumberBR(row.original.rent) },
    {
      accessorKey: "paid",
      header: "Pago",
      cell: ({ row }) => (
        <Badge variant={row.original.paid ? "default" : "secondary"}>
          {row.original.paid ? "Sim" : "Não"}
        </Badge>
      ),
    },
    {
      accessorKey: "warnings",
      header: "Avisos",
      cell: ({ row }) => (
        <span className={row.original.warnings > 0 ? "font-medium text-amber-600 dark:text-amber-400" : ""}>
          {row.original.warnings}
        </span>
      ),
    },
    {
      accessorKey: "guild",
      header: "Guild house",
      cell: ({ row }) => (row.original.guild ? <Badge variant="secondary">Sim</Badge> : "—"),
    },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => (
        <RowActionsMenu>
          <DropdownMenuItem render={<Link href={`/admin/houses/${row.original.id}`} />}>
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
        <h1 className="text-2xl font-semibold">Houses</h1>
        <p className="text-muted-foreground">
          Modere as houses do mapa. O cadastro (id, tiles, doors) nasce no RME — aqui só edição.
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
  );
}
