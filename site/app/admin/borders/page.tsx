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

type BorderRow = {
  id: number;
  name: string;
  group: number | null;
  optional: boolean;
  updatedAt: string;
  previewItemId: number | null;
};

const YES_NO_OPTIONS = [
  { value: "true", label: "Sim" },
  { value: "false", label: "Não" },
];

// eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not a page route
const exportXmlLink = <a href="/api/admin/borders/export" />;

export default function AdminBordersPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating, mutate } = useSWR<PaginatedResult<BorderRow>>(
    `/api/admin/borders?${table.buildQueryParams().toString()}`,
    fetcher
  );

  const images = useEntityImages(
    "item",
    (data?.data ?? []).flatMap((b) => (b.previewItemId ? [b.previewItemId] : []))
  );

  async function handleDelete(id: number) {
    const response = await fetch(`/api/admin/borders/${id}`, { method: "DELETE" });

    if (!response.ok) {
      toast.error("Não foi possível remover o border.");
      return;
    }

    toast.success("Border removido.");
    mutate();
  }

  const filterFields: FilterFieldConfig[] = [
    { key: "optional", label: "Opcional", type: "select", options: YES_NO_OPTIONS },
    { key: "group", label: "Group", type: "number" },
    { key: "edgesConfigured", label: "Possui edges configurados", type: "select", options: YES_NO_OPTIONS },
  ];

  const columns: ColumnDef<BorderRow>[] = [
    { accessorKey: "id", header: "ID" },
    {
      id: "image",
      header: "Imagem",
      cell: ({ row }) =>
        row.original.previewItemId ? (
          <EntityThumb
            entityType="item"
            id={row.original.previewItemId}
            name={row.original.name}
            image={images.get(row.original.previewItemId) ?? null}
          />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    { accessorKey: "name", header: "Nome" },
    {
      accessorKey: "group",
      header: "Group",
      cell: ({ row }) => row.original.group ?? "—",
    },
    {
      accessorKey: "optional",
      header: "Opcional",
      cell: ({ row }) => (
        <Badge variant={row.original.optional ? "default" : "secondary"}>
          {row.original.optional ? "Sim" : "Não"}
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
          <DropdownMenuItem render={<Link href={`/admin/borders/${row.original.id}`} />}>
            <Pencil className="size-4" />
            Editar
          </DropdownMenuItem>
          <CopyXmlButton
            variant="menuitem"
            label="Copiar XML deste border"
            getText={async () => {
              const response = await fetch(`/api/admin/borders/${row.original.id}/export`);
              return response.text();
            }}
          />
          <DuplicateButton
            endpoint={`/api/admin/borders/${row.original.id}/duplicate`}
            editPathBase="/admin/borders"
            onDuplicated={() => mutate()}
            variant="menuitem"
          />
          <DeleteRowMenuItem
            title="Remover border"
            description="Esta ação não pode ser desfeita. Grounds que referenciam esse border ficarão com um id inválido."
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
        <h1 className="text-2xl font-semibold">Borders</h1>
        <p className="text-muted-foreground">
          CRUD de bordas exportável para o <code>borders.xml</code> (RME).
        </p>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isFiltering={!isLoading && isValidating}
        searchPlaceholder="Buscar por nome ou id de item usado nas bordas..."
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
              endpoint="/api/admin/borders/import"
              title="Importar borders.xml"
              description={
                <>
                  Envie um arquivo no formato do <code>borders.xml</code> do RME. Borders com
                  dados inválidos ou id duplicado são ignorados e reportados ao final.
                </>
              }
              replaceLabel="Substituir todos os borders existentes antes de importar"
              itemLabel="border(s)"
              onImported={() => mutate()}
            />
            <CopyXmlButton
              getText={async () => {
                const response = await fetch("/api/admin/borders/export");
                return response.text();
              }}
            />
            <Button variant="outline" nativeButton={false} render={exportXmlLink}>
              <Download className="size-4" />
              Exportar XML
            </Button>
            <Button nativeButton={false} render={<Link href="/admin/borders/new" />}>
              <Plus className="size-4" />
              Novo border
            </Button>
          </>
        }
      />
    </div>
  );
}
