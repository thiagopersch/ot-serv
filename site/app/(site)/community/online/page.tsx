"use client";

import Link from "next/link";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import { useServerTable } from "@/hooks/use-server-table";
import { DataTable } from "@/components/shared/data-table";

type OnlinePlayer = {
  id: number;
  name: string;
  level: number;
  vocationName: string;
};

const columns: ColumnDef<OnlinePlayer>[] = [
  {
    accessorKey: "name",
    header: "Nome",
    cell: ({ row }) => (
      <Link href={`/community/characters/${encodeURIComponent(row.original.name)}`} className="hover:underline">
        {row.original.name}
      </Link>
    ),
  },
  { accessorKey: "level", header: "Level" },
  { accessorKey: "vocationName", header: "Vocação" },
];

export default function OnlinePlayersPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating } = useSWR<PaginatedResult<OnlinePlayer> & { count: number }>(
    `/api/public/online?${table.buildQueryParams().toString()}`,
    fetcher,
    { refreshInterval: 30_000 }
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="mb-2 text-2xl font-semibold">Quem está online?</h1>
      <p className="mb-6 text-muted-foreground">{data?.count ?? 0} jogador(es) online agora.</p>
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
