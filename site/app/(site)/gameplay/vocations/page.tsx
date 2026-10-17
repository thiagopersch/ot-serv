"use client";

import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import type { EntityImageInfo } from "@/components/shared/use-entity-images";
import { useServerTable } from "@/hooks/use-server-table";
import { DataTable } from "@/components/shared/data-table";
import { EntityThumb } from "@/components/shared/entity-thumb";

type PublicVocation = {
  id: number;
  name: string;
  description: string;
  image: EntityImageInfo | null;
};

const columns: ColumnDef<PublicVocation>[] = [
  {
    accessorKey: "image",
    header: "",
    cell: ({ row }) => (
      <EntityThumb entityType="vocation" id={row.original.id} name={row.original.name} image={row.original.image} />
    ),
  },
  { accessorKey: "name", header: "Nome" },
  { accessorKey: "description", header: "Descrição" },
];

export default function PublicVocationsPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating } = useSWR<PaginatedResult<PublicVocation>>(
    `/api/public/vocations?${table.buildQueryParams().toString()}`,
    fetcher
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Vocações</h1>
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isFiltering={!isLoading && isValidating}
        searchPlaceholder="Buscar vocação..."
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
