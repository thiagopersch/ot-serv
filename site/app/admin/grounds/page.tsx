"use client";

import Link from "next/link";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, Pencil, Plus } from "lucide-react";
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
import { XmlImportDialog } from "@/components/shared/xml-import-dialog";
import { EntityThumb } from "@/components/shared/entity-thumb";
import { useEntityImages } from "@/components/shared/use-entity-images";
import type { FilterFieldConfig } from "@/components/shared/advanced-filter-panel";

type GroundRow = {
  id: number;
  name: string;
  serverLookId: number;
  zOrder: number;
  soloOptional: boolean;
  tilesetCategoryId: number | null;
  updatedAt: string;
};

type CategoryOption = { id: number; label: string };
type CategoryApiResult = { categories: CategoryOption[] };

const YES_NO_OPTIONS = [
  { value: "true", label: "Sim" },
  { value: "false", label: "Não" },
];

// eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not a page route
const exportXmlLink = <a href="/api/admin/grounds/export" />;

export default function AdminGroundsPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating, mutate } = useSWR<
    PaginatedResult<GroundRow>
  >(`/api/admin/grounds?${table.buildQueryParams().toString()}`, fetcher);

  const { data: categoriesData } = useSWR<CategoryApiResult>(
    "/api/admin/tilesets/categories?type=BRUSH&kind=TERRAIN,TERRAIN_AND_RAW",
    fetcher,
  );

  const images = useEntityImages(
    "item",
    (data?.data ?? []).map((g) => g.serverLookId),
  );

  async function handleDelete(id: number) {
    const response = await fetch(`/api/admin/grounds/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      toast.error("Não foi possível remover o ground.");
      return;
    }

    toast.success("Ground removido.");
    mutate();
  }

  const filterFields: FilterFieldConfig[] = [
    { key: "soloOptional", label: "Solo optional", type: "select", options: YES_NO_OPTIONS },
    {
      key: "tilesetCategoryId",
      label: "Categoria do tileset",
      type: "select",
      options: (categoriesData?.categories ?? []).map((category) => ({
        value: String(category.id),
        label: category.label,
      })),
    },
    { key: "zOrderMin", label: "Z-order mínimo", type: "number" },
    { key: "zOrderMax", label: "Z-order máximo", type: "number" },
    { key: "hasBorders", label: "Possui bordas vinculadas", type: "select", options: YES_NO_OPTIONS },
    { key: "hasFriends", label: "Possui friends", type: "select", options: YES_NO_OPTIONS },
  ];

  const columns: ColumnDef<GroundRow>[] = [
    { accessorKey: "id", header: "ID" },
    {
      id: "image",
      header: "Imagem",
      cell: ({ row }) => (
        <EntityThumb
          entityType="item"
          id={row.original.serverLookId}
          name={row.original.name}
          image={images.get(row.original.serverLookId) ?? null}
        />
      ),
    },
    { accessorKey: "name", header: "Nome" },
    { accessorKey: "serverLookId", header: "server_lookid" },
    { accessorKey: "zOrder", header: "z-order" },
    {
      accessorKey: "soloOptional",
      header: "Solo optional",
      cell: ({ row }) => (
        <Badge variant={row.original.soloOptional ? "default" : "secondary"}>
          {row.original.soloOptional ? "Sim" : "Não"}
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
          <DropdownMenuItem render={<Link href={`/admin/grounds/${row.original.id}`} />}>
            <Pencil className="size-4" />
            Editar
          </DropdownMenuItem>
          <CopyXmlButton
            variant="menuitem"
            label="Copiar XML deste ground"
            getText={async () => {
              const response = await fetch(`/api/admin/grounds/${row.original.id}/export`);
              return response.text();
            }}
          />
          <DuplicateButton
            endpoint={`/api/admin/grounds/${row.original.id}/duplicate`}
            editPathBase="/admin/grounds"
            onDuplicated={() => mutate()}
            variant="menuitem"
          />
          <DeleteRowMenuItem
            title="Remover ground"
            description="Esta ação não pode ser desfeita."
            confirmLabel="Remover"
            onConfirm={() => handleDelete(row.original.id)}
          />
        </RowActionsMenu>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Grounds</h1>
        <p className="text-muted-foreground">
          CRUD de brushes exportável para o <code>grounds.xml</code> (RME).
        </p>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isFiltering={!isLoading && isValidating}
        searchPlaceholder="Buscar por nome ou id de item (server_lookid ou item usado no conteúdo)..."
        searchValue={table.searchInput}
        onSearchChange={table.handleSearchChange}
        filters={filterFields}
        filterValues={table.draftFilters}
        onFilterValuesChange={table.setDraftFilters}
        onApplyFilters={table.applyFilters}
        onClearFilters={table.clearFilters}
        manualPagination
        pageIndex={table.pageIndex}
        pageSize={table.pageSize}
        pageCount={data?.pageCount ?? 1}
        totalCount={data?.total}
        onPageChange={table.setPageIndex}
        onPageSizeChange={table.setPageSize}
        toolbar={
          <>
            <XmlImportDialog
              endpoint="/api/admin/grounds/import"
              title="Importar grounds.xml"
              description={
                <>
                  Envie um arquivo no formato do <code>grounds.xml</code> do
                  RME. Brushes com dados inválidos são ignorados e reportados ao
                  final.
                </>
              }
              replaceLabel="Substituir todos os grounds existentes antes de importar"
              itemLabel="ground(s)"
              onImported={() => mutate()}
            />
            <CopyXmlButton
              getText={async () => {
                const response = await fetch("/api/admin/grounds/export");
                return response.text();
              }}
            />
            <Button
              variant="outline"
              nativeButton={false}
              render={exportXmlLink}
            >
              <Download className="size-4" />
              Exportar XML
            </Button>
            <Button
              nativeButton={false}
              render={<Link href="/admin/grounds/new" />}
            >
              <Plus className="size-4" />
              Novo ground
            </Button>
          </>
        }
      />
    </div>
  );
}
