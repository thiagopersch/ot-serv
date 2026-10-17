"use client";

import Link from "next/link";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import { WALL_FILE_BRUSH_TYPES } from "@/lib/validations/admin/wall";
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

type WallRow = {
  id: number;
  name: string;
  type: string;
  serverLookId: number;
  draggable: boolean;
  onBlocking: boolean;
  onDuplicate: boolean;
  oneSize: boolean;
  redoBorders: boolean;
  reborder: boolean;
  thickness: string;
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
const exportXmlLink = <a href="/api/admin/walls/export" />;

export default function AdminWallsPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating, mutate } = useSWR<
    PaginatedResult<WallRow>
  >(`/api/admin/walls?${table.buildQueryParams().toString()}`, fetcher);

  const { data: categoriesData } = useSWR<CategoryApiResult>(
    "/api/admin/tilesets/categories?type=BRUSH&kind=TERRAIN,TERRAIN_AND_RAW",
    fetcher,
  );

  const images = useEntityImages(
    "item",
    (data?.data ?? []).map((w) => w.serverLookId),
  );

  async function handleDelete(id: number) {
    const response = await fetch(`/api/admin/walls/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      toast.error("Não foi possível remover a wall.");
      return;
    }

    toast.success("Wall removida.");
    mutate();
  }

  const filterFields: FilterFieldConfig[] = [
    {
      key: "type",
      label: "Tipo",
      type: "select",
      options: WALL_FILE_BRUSH_TYPES.map((type) => ({ value: type, label: type })),
    },
    { key: "draggable", label: "Draggable", type: "select", options: YES_NO_OPTIONS },
    { key: "onBlocking", label: "On blocking", type: "select", options: YES_NO_OPTIONS },
    { key: "onDuplicate", label: "On duplicate", type: "select", options: YES_NO_OPTIONS },
    { key: "redoBorders", label: "Redo borders", type: "select", options: YES_NO_OPTIONS },
    { key: "oneSize", label: "One size", type: "select", options: YES_NO_OPTIONS },
    { key: "reborder", label: "Reborder", type: "select", options: YES_NO_OPTIONS },
    {
      key: "tilesetCategoryId",
      label: "Categoria do tileset",
      type: "select",
      options: (categoriesData?.categories ?? []).map((category) => ({
        value: String(category.id),
        label: category.label,
      })),
    },
    {
      key: "contentShape",
      label: "Conteúdo",
      type: "select",
      options: [
        { value: "walls", label: "Possui segmentos de parede" },
        { value: "items", label: "Possui itens diretos" },
        { value: "composites", label: "Possui composites" },
        { value: "alternates", label: "Possui alternates" },
      ],
    },
  ];

  const columns: ColumnDef<WallRow>[] = [
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
    {
      accessorKey: "type",
      header: "Tipo",
      cell: ({ row }) => <Badge variant="secondary">{row.original.type}</Badge>,
    },
    { accessorKey: "serverLookId", header: "server_lookid" },
    {
      accessorKey: "thickness",
      header: "Thickness",
      cell: ({ row }) => row.original.thickness || "—",
    },
    {
      accessorKey: "draggable",
      header: "Draggable",
      cell: ({ row }) => (
        <Badge variant={row.original.draggable ? "default" : "secondary"}>
          {row.original.draggable ? "Sim" : "Não"}
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
          <DropdownMenuItem render={<Link href={`/admin/walls/${row.original.id}`} />}>
            <Pencil className="size-4" />
            Editar
          </DropdownMenuItem>
          <CopyXmlButton
            variant="menuitem"
            label="Copiar XML desta wall"
            getText={async () => {
              const response = await fetch(`/api/admin/walls/${row.original.id}/export`);
              return response.text();
            }}
          />
          <DuplicateButton
            endpoint={`/api/admin/walls/${row.original.id}/duplicate`}
            editPathBase="/admin/walls"
            onDuplicated={() => mutate()}
            variant="menuitem"
          />
          <DeleteRowMenuItem
            title="Remover wall"
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
        <h1 className="text-2xl font-semibold">Walls</h1>
        <p className="text-muted-foreground">
          CRUD de brushes exportável para o <code>walls.xml</code> (RME).
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
              endpoint="/api/admin/walls/import"
              title="Importar walls.xml"
              description={
                <>
                  Envie um arquivo no formato do <code>walls.xml</code> do RME.
                  Brushes com dados inválidos são ignorados e reportados ao
                  final.
                </>
              }
              replaceLabel="Substituir todas as walls existentes antes de importar"
              itemLabel="wall(s)"
              onImported={() => mutate()}
            />
            <CopyXmlButton
              getText={async () => {
                const response = await fetch("/api/admin/walls/export");
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
              render={<Link href="/admin/walls/new" />}
            >
              <Plus className="size-4" />
              Nova wall
            </Button>
          </>
        }
      />
    </div>
  );
}
