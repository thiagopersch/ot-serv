"use client";

import Link from "next/link";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Radio } from "lucide-react";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import { useServerTable } from "@/hooks/use-server-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/data-table";

type CastPlayer = {
  id: number;
  name: string;
  level: number;
  vocationName: string;
  castViewers: number;
  castDescription: string;
};

const columns: ColumnDef<CastPlayer>[] = [
  {
    accessorKey: "name",
    header: "Transmissão",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Radio className="size-3.5 text-red-500" />
        <Link href={`/community/characters/${encodeURIComponent(row.original.name)}`} className="hover:underline">
          {row.original.name}
        </Link>
      </div>
    ),
  },
  { accessorKey: "level", header: "Level" },
  { accessorKey: "vocationName", header: "Vocação" },
  {
    accessorKey: "castDescription",
    header: "Descrição",
    cell: ({ row }) => row.original.castDescription || "—",
  },
  {
    accessorKey: "castViewers",
    header: "Espectadores",
    cell: ({ row }) => (
      <span className="flex items-center gap-1">
        <Eye className="size-3.5 text-muted-foreground" />
        {row.original.castViewers}
      </span>
    ),
  },
];

export default function CastPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating } = useSWR<PaginatedResult<CastPlayer> & { count: number }>(
    `/api/public/cast?${table.buildQueryParams().toString()}`,
    fetcher,
    { refreshInterval: 30_000 }
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="mb-2 text-2xl font-semibold">Quem está ao vivo?</h1>
      <p className="mb-2 text-muted-foreground">{data?.count ?? 0} transmissão(ões) ao vivo agora.</p>
      <p className="mb-6 text-sm text-muted-foreground">
        Para assistir, conecte-se pelo cliente do jogo usando o nome do personagem que está
        transmitindo e a senha de espectador informada por ele.
      </p>

      {!isLoading && (data?.count ?? 0) === 0 && (
        <Badge variant="secondary" className="mb-6">
          Nenhuma transmissão ao vivo no momento
        </Badge>
      )}

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isFiltering={!isLoading && isValidating}
        searchPlaceholder="Buscar transmissão..."
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
