"use client";

import Link from "next/link";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, ListTodo, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import { useServerTable } from "@/hooks/use-server-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActionsMenu, DeleteRowMenuItem } from "@/components/shared/row-actions-menu";
import { DuplicateButton } from "@/components/shared/duplicate-button";
import { CopyXmlButton } from "@/components/shared/copy-xml-button";
import { LastUpdatedCell } from "@/components/shared/last-updated-cell";
import { TilesetImportDialog } from "@/components/admin/tilesets/tileset-import-dialog";
import { IntegrityCheckDialog } from "@/components/admin/tilesets/integrity-check-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type TilesetRow = {
  id: number;
  name: string;
  description: string | null;
  order: number;
  active: boolean;
  updatedAt: string;
  _count: { categories: number };
  categories: { name: string }[];
};

// eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not a page route
const exportAllXmlLink = <a href="/api/admin/tilesets/export" />;

export default function AdminTilesetsPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating, mutate } = useSWR<PaginatedResult<TilesetRow>>(
    `/api/admin/tilesets?${table.buildQueryParams().toString()}`,
    fetcher
  );

  async function handleDelete(id: number) {
    const response = await fetch(`/api/admin/tilesets/${id}`, { method: "DELETE" });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(body?.error ?? "Não foi possível remover o tileset. Ele ainda tem categorias — mova-as primeiro na tela de detalhe.");
      return;
    }

    toast.success("Tileset removido.");
    mutate();
  }

  const columns: ColumnDef<TilesetRow>[] = [
    { accessorKey: "id", header: "ID" },
    { accessorKey: "name", header: "Nome" },
    {
      accessorKey: "order",
      header: "Ordem",
    },
    {
      id: "categories",
      header: "Categorias",
      cell: ({ row }) => {
        const names = row.original.categories.map((category) => category.name);

        if (names.length === 0) return <span className="text-muted-foreground">—</span>;

        const text = names.join(", ");

        return (
          <Tooltip>
            <TooltipTrigger className="block max-w-[240px] cursor-default truncate text-left underline decoration-dotted underline-offset-2">
              {text}
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">{text}</p>
            </TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      accessorKey: "active",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.active ? "default" : "secondary"}>
          {row.original.active ? "Ativo" : "Inativo"}
        </Badge>
      ),
    },
    {
      accessorKey: "updatedAt",
      header: "Última atualização",
      cell: ({ row }) => <LastUpdatedCell date={row.original.updatedAt} />,
    },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => (
        <RowActionsMenu>
          <DropdownMenuItem render={<Link href={`/admin/tilesets/${row.original.id}`} />}>
            <Pencil className="size-4" />
            Editar / gerenciar categorias
          </DropdownMenuItem>
          <CopyXmlButton
            variant="menuitem"
            label="Copiar XML deste tileset"
            getText={async () => {
              const response = await fetch(`/api/admin/tilesets/export?ids=${row.original.id}`);
              return response.text();
            }}
          />
          <DuplicateButton
            endpoint={`/api/admin/tilesets/${row.original.id}/duplicate`}
            editPathBase="/admin/tilesets"
            onDuplicated={() => mutate()}
            variant="menuitem"
          />
          <DeleteRowMenuItem
            title="Remover tileset"
            description="Esta ação não pode ser desfeita. Se este tileset ainda tiver categorias vinculadas, a exclusão será bloqueada — mova-as primeiro na tela de detalhe."
            confirmLabel="Remover"
            onConfirm={() => handleDelete(row.original.id)}
          />
        </RowActionsMenu>
      ),
    },
  ];

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Tilesets</h1>
        <p className="text-muted-foreground">
          Gerenciamento visual do <code>tilesets.xml</code> (RME) — Tilesets, Categorias e os
          brushes/itens vinculados a cada uma.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isFiltering={!isLoading && isValidating}
        searchPlaceholder="Buscar por nome, brush ou ID de item..."
        searchValue={table.searchInput}
        onSearchChange={table.handleSearchChange}
        manualPagination
        pageIndex={table.pageIndex}
        pageSize={table.pageSize}
        pageCount={data?.pageCount ?? 1}
        totalCount={data?.total}
        onPageChange={table.setPageIndex}
        onPageSizeChange={table.setPageSize}
        toolbar={
          <>
            <Button variant="outline" nativeButton={false} render={<Link href="/admin/tilesets/uncategorized" />}>
              <ListTodo className="size-4" />
              Brushes sem categoria
            </Button>
            <IntegrityCheckDialog />
            <TilesetImportDialog onImported={() => mutate()} />
            <CopyXmlButton
              getText={async () => {
                const response = await fetch("/api/admin/tilesets/export");
                return response.text();
              }}
            />
            <Button variant="outline" nativeButton={false} render={exportAllXmlLink}>
              <Download className="size-4" />
              Exportar todos (XML)
            </Button>
            <Button nativeButton={false} render={<Link href="/admin/tilesets/new" />}>
              <Plus className="size-4" />
              Novo tileset
            </Button>
          </>
        }
      />
      </div>
    </TooltipProvider>
  );
}
