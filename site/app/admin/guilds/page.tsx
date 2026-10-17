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

type GuildRow = {
  id: number;
  name: string;
  motd: string;
  owner: { id: number; name: string };
  rankCount: number;
  inviteCount: number;
};

export default function AdminGuildsPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating } = useSWR<PaginatedResult<GuildRow>>(
    `/api/admin/guilds?${table.buildQueryParams().toString()}`,
    fetcher
  );

  const columns: ColumnDef<GuildRow>[] = [
    { accessorKey: "id", header: "ID" },
    { accessorKey: "name", header: "Nome" },
    {
      id: "owner",
      header: "Dono",
      cell: ({ row }) => (
        <Link href={`/admin/players/${row.original.owner.id}`} className="text-primary hover:underline">
          {row.original.owner.name}
        </Link>
      ),
    },
    {
      accessorKey: "motd",
      header: "MOTD",
      cell: ({ row }) => (
        <span className="text-muted-foreground line-clamp-1 max-w-[280px]">{row.original.motd || "—"}</span>
      ),
    },
    {
      accessorKey: "rankCount",
      header: "Ranks",
      cell: ({ row }) => <Badge variant="secondary">{row.original.rankCount}</Badge>,
    },
    {
      accessorKey: "inviteCount",
      header: "Convites pendentes",
      cell: ({ row }) => row.original.inviteCount,
    },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => (
        <RowActionsMenu>
          <DropdownMenuItem render={<Link href={`/admin/guilds/${row.original.id}`} />}>
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
        <h1 className="text-2xl font-semibold">Guilds</h1>
        <p className="text-muted-foreground">
          Modere as guilds criadas pelos jogadores. Fundação/dissolução acontece pelo cliente de jogo.
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
