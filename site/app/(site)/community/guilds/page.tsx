"use client";

import Link from "next/link";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import { useServerTable } from "@/hooks/use-server-table";
import { DataTable } from "@/components/shared/data-table";

type GuildRow = {
  id: number;
  name: string;
  motd: string;
  owner: string;
  memberCount: number;
};

const columns: ColumnDef<GuildRow>[] = [
  {
    accessorKey: "name",
    header: "Guild",
    cell: ({ row }) => (
      <Link href={`/community/guilds/${encodeURIComponent(row.original.name)}`} className="hover:underline">
        {row.original.name}
      </Link>
    ),
  },
  { accessorKey: "owner", header: "Líder" },
  { accessorKey: "memberCount", header: "Membros" },
];

export default function GuildsPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating } = useSWR<PaginatedResult<GuildRow>>(
    `/api/public/guilds?${table.buildQueryParams().toString()}`,
    fetcher
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Guilds</h1>
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isFiltering={!isLoading && isValidating}
        searchPlaceholder="Buscar guild..."
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
