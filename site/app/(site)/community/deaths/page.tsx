"use client";

import Link from "next/link";
import useSWR from "swr";
import dayjs from "dayjs";
import type { ColumnDef } from "@tanstack/react-table";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import { useServerTable } from "@/hooks/use-server-table";
import { DataTable } from "@/components/shared/data-table";

type Death = {
  id: number;
  date: number;
  level: number;
  playerName: string;
  killerNames: string[];
};

const columns: ColumnDef<Death>[] = [
  {
    accessorKey: "playerName",
    header: "Jogador",
    cell: ({ row }) => (
      <Link
        href={`/community/characters/${encodeURIComponent(row.original.playerName)}`}
        className="hover:underline"
      >
        {row.original.playerName}
      </Link>
    ),
  },
  { accessorKey: "level", header: "Level" },
  {
    id: "killers",
    header: "Morto por",
    cell: ({ row }) => row.original.killerNames.join(", ") || "—",
  },
  {
    accessorKey: "date",
    header: "Data",
    cell: ({ row }) => dayjs.unix(row.original.date).format("DD/MM/YYYY HH:mm"),
  },
];

export default function DeathsPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating } = useSWR<PaginatedResult<Death>>(
    `/api/public/deaths?${table.buildQueryParams().toString()}`,
    fetcher
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Últimas mortes</h1>
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isFiltering={!isLoading && isValidating}
        searchPlaceholder="Buscar jogador..."
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
