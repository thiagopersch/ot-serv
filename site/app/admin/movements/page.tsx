"use client";

import Link from "next/link";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import {
  MOVEMENT_EVENT_TYPES,
  MOVEMENT_SELECTOR_TYPES,
  type MovementInput,
} from "@/lib/validations/admin/movement";
import { useServerTable } from "@/hooks/use-server-table";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActionsMenu, DeleteRowMenuItem } from "@/components/shared/row-actions-menu";
import { DuplicateButton } from "@/components/shared/duplicate-button";
import { CopyXmlButton } from "@/components/shared/copy-xml-button";
import { XmlImportDialog } from "@/components/shared/xml-import-dialog";
import { XmlBundlePanel } from "@/components/shared/xml-bundle-panel";
import { EntityThumb } from "@/components/shared/entity-thumb";
import { useEntityImages } from "@/components/shared/use-entity-images";
import type { FilterFieldConfig } from "@/components/shared/advanced-filter-panel";

type MovementRow = MovementInput & { id: number };

// eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not a page route
const exportXmlLink = <a href="/api/admin/movements/export" />;

function selectorSummary(row: MovementRow): string {
  if (row.selectorType === "ITEM_ID") {
    if (row.itemId == null) return "—";
    return row.itemIdRangeEnd != null && row.itemIdRangeEnd !== row.itemId
      ? `item ${row.itemId}-${row.itemIdRangeEnd}`
      : `item ${row.itemId}`;
  }
  if (row.selectorType === "ITEM_RANGE") {
    return row.ranges.map((r) => `${r.from}-${r.to}`).join(", ") || "—";
  }
  if (row.selectorType === "UNIQUE_ID")
    return `uniqueid ${row.uniqueId ?? "—"}`;
  if (row.selectorType === "ACTION_ID")
    return `actionid ${row.actionId ?? "—"}`;
  return "—";
}

export default function AdminMovementsPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating, mutate } = useSWR<
    PaginatedResult<MovementRow>
  >(`/api/admin/movements?${table.buildQueryParams().toString()}`, fetcher);

  const itemIds = (data?.data ?? [])
    .filter((row) => row.selectorType === "ITEM_ID" && row.itemId != null)
    .map((row) => row.itemId as number);
  const images = useEntityImages("item", itemIds);

  async function handleDelete(id: number) {
    const response = await fetch(`/api/admin/movements/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      toast.error("Não foi possível remover o movement.");
      return;
    }

    toast.success("Movement removido.");
    mutate();
  }

  const filterFields: FilterFieldConfig[] = [
    {
      key: "eventType",
      label: "Tipo de evento",
      type: "select",
      options: MOVEMENT_EVENT_TYPES.map((type) => ({
        value: type,
        label: type,
      })),
    },
    {
      key: "selectorType",
      label: "Seletor",
      type: "select",
      options: MOVEMENT_SELECTOR_TYPES.map((type) => ({
        value: type,
        label: type,
      })),
    },
  ];

  const columns: ColumnDef<MovementRow>[] = [
    { accessorKey: "id", header: "ID" },
    { accessorKey: "eventType", header: "Evento" },
    {
      id: "item",
      header: "Item",
      cell: ({ row }) => {
        const { selectorType, itemId } = row.original;
        if (selectorType !== "ITEM_ID" || itemId == null) return "—";
        return (
          <EntityThumb
            entityType="item"
            id={itemId}
            image={images.get(itemId) ?? null}
          />
        );
      },
    },
    {
      id: "selector",
      header: "Seletor",
      cell: ({ row }) => selectorSummary(row.original),
    },
    {
      accessorKey: "slot",
      header: "Slot",
      cell: ({ row }) => row.original.slot || "—",
    },
    {
      id: "action",
      header: "Ação",
      cell: ({ row }) =>
        `${row.original.actionKind === "SCRIPT" ? "script" : "function"}: ${row.original.actionValue}`,
    },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => (
        <RowActionsMenu>
          <DropdownMenuItem render={<Link href={`/admin/movements/${row.original.id}`} />}>
            <Pencil className="size-4" />
            Editar
          </DropdownMenuItem>
          <DuplicateButton
            endpoint={`/api/admin/movements/${row.original.id}/duplicate`}
            editPathBase="/admin/movements"
            onDuplicated={() => mutate()}
            variant="menuitem"
          />
          <DeleteRowMenuItem
            title="Remover movement"
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
        <h1 className="text-2xl font-semibold">Movements</h1>
        <p className="text-muted-foreground">
          CRUD de movevents exportável para o <code>movements.xml</code> do
          servidor. Não existe export/import de uma linha só — apenas em lote.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isFiltering={!isLoading && isValidating}
        searchPlaceholder="Buscar por slot ou ação..."
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
              endpoint="/api/admin/movements/import"
              title="Importar movements.xml"
              description={
                <>
                  Envie um arquivo no formato do <code>movements.xml</code> do
                  OTServer.
                </>
              }
              replaceLabel="Substituir todos os movements existentes antes de importar"
              itemLabel="movement(s)"
              onImported={() => mutate()}
            />
            <CopyXmlButton
              getText={async () => {
                const response = await fetch("/api/admin/movements/export");
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
            <XmlBundlePanel onImported={() => mutate()} />
            <Button
              nativeButton={false}
              render={<Link href="/admin/movements/new" />}
            >
              <Plus className="size-4" />
              Novo movement
            </Button>
          </>
        }
      />
    </div>
  );
}
