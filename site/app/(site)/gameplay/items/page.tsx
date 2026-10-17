"use client";

import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import type { EntityImageInfo } from "@/components/shared/use-entity-images";
import { useServerTable } from "@/hooks/use-server-table";
import { DataTable } from "@/components/shared/data-table";
import { EntityThumb } from "@/components/shared/entity-thumb";

type PublicItem = {
  id: number;
  name: string;
  article: string;
  description: string;
  attack: number;
  defense: number;
  armor: number;
  image: EntityImageInfo | null;
};

const columns: ColumnDef<PublicItem>[] = [
  {
    accessorKey: "image",
    header: "",
    cell: ({ row }) => (
      <EntityThumb
        entityType="item"
        id={row.original.id}
        name={row.original.name}
        image={row.original.image}
      />
    ),
  },
  {
    accessorKey: "name",
    header: "Nome",
    cell: ({ row }) => (
      <span>
        {row.original.article ? `${row.original.article} ` : ""}
        {row.original.name}
      </span>
    ),
  },
  {
    id: "combat",
    header: "Ataque / Defesa",
    cell: ({ row }) => {
      const { attack, defense, armor } = row.original;
      const parts: string[] = [];
      if (attack) parts.push(`ATQ ${attack}`);
      if (defense) parts.push(`DEF ${defense}`);
      if (armor) parts.push(`ARM ${armor}`);
      return <span>{parts.length ? parts.join(" / ") : "—"}</span>;
    },
  },
  {
    accessorKey: "description",
    header: "Descrição",
    cell: ({ row }) => (
      <span className="block max-w-xs min-w-48 text-wrap whitespace-normal break-words">
        {row.original.description || "—"}
      </span>
    ),
  },
];

export default function PublicItemsPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating } = useSWR<PaginatedResult<PublicItem>>(
    `/api/public/items?${table.buildQueryParams().toString()}`,
    fetcher,
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Itens</h1>
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isFiltering={!isLoading && isValidating}
        searchPlaceholder="Buscar item..."
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
