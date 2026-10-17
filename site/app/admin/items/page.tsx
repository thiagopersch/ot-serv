"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { Download, ImageUp, Info, MoreVertical, Pencil, PencilLine, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import {
  ITEM_TYPES,
  SLOT_TYPES,
  WEAPON_TYPES,
} from "@/lib/validations/admin/item";
import { useServerTable } from "@/hooks/use-server-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RowActionsMenu, DeleteRowMenuItem } from "@/components/shared/row-actions-menu";
import { DuplicateButton } from "@/components/shared/duplicate-button";
import { CopyXmlButton } from "@/components/shared/copy-xml-button";
import { XmlImportDialog } from "@/components/shared/xml-import-dialog";
import { OtbSyncDialog } from "@/components/admin/items/otb-sync-dialog";
import { ItemsXmlSyncButton } from "@/components/admin/items/items-xml-sync-button";
import { XmlBundlePanel } from "@/components/shared/xml-bundle-panel";
import { BulkEditItemsDialog } from "@/components/admin/items/bulk-edit-items-dialog";
import { EntityThumb } from "@/components/shared/entity-thumb";
import { EntityImageUploadDialog } from "@/components/shared/entity-image-upload-dialog";
import { useEntityImages } from "@/components/shared/use-entity-images";
import { PublishedToggle } from "@/components/shared/published-toggle";
import type { FilterFieldConfig } from "@/components/shared/advanced-filter-panel";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ENUM_LABELS } from "@/lib/item-field-help";
import {
  formatOz,
  getAttributeEntries,
  getProtectionEntries,
  type ItemDisplayRow,
} from "@/lib/item-display";
import { CountTooltip, LabelTooltip } from "@/components/shared/count-tooltip";

type ItemRow = {
  id: number;
  name: string;
  article: string;
  description: string;
  type: string;
  weaponType: string;
  slotType: string;
  weight: number;
  attack: number;
  defense: number;
  armor: number;
  worth: number;
  containerSize: number;
  published: boolean;
} & ItemDisplayRow;

/** Nome em português da opção (sem o "(inglês)" do rótulo) e o texto do hover com o inglês. */
function enumCell(group: "weaponType" | "slotType", value: string) {
  if (!value) return "—";
  const full = ENUM_LABELS[group][value] ?? value;
  return <LabelTooltip label={full.replace(/\s*\(.*\)$/, "")} hint={value} />;
}

/** Só o nome em português (sem o "(inglês)" do rótulo). */
function typeName(group: "type" | "weaponType" | "slotType", value: string) {
  return (ENUM_LABELS[group][value] ?? value).replace(/\s*\(.*\)$/, "");
}

function enumOptions(group: "weaponType" | "slotType", values: readonly string[]) {
  return values.filter(Boolean).map((value) => ({
    value,
    label: ENUM_LABELS[group][value] ?? value,
  }));
}
// eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not a page route
const exportXmlLink = <a href="/api/admin/items/export" />;

export default function AdminItemsPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating, mutate } = useSWR<
    PaginatedResult<ItemRow>
  >(`/api/admin/items?${table.buildQueryParams().toString()}`, fetcher);

  const images = useEntityImages(
    "item",
    (data?.data ?? []).map((i) => i.id),
  );

  // Ids selecionados atravessando páginas — sobrevive à troca de página sozinho, já que trocar de
  // página só troca a query do SWR acima (não desmonta a página nem a tabela). A tabela só recebe
  // (e só sabe alterar) a fatia desse conjunto que corresponde às linhas da página atual.
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);

  const rowSelectionForCurrentPage = useMemo(() => {
    const map: RowSelectionState = {};
    for (const row of data?.data ?? []) if (selectedIds.has(row.id)) map[String(row.id)] = true;
    return map;
  }, [data, selectedIds]);

  function handleRowSelectionChange(updater: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)) {
    const next = typeof updater === "function" ? updater(rowSelectionForCurrentPage) : updater;
    setSelectedIds((current) => {
      const merged = new Set(current);
      const pageIds = new Set((data?.data ?? []).map((row) => row.id));
      // Só ids da página atual podem ser adicionados/removidos por essa mudança — os de outras
      // páginas, já guardados em `merged`, ficam intactos.
      for (const id of pageIds) {
        if (next[String(id)]) merged.add(id);
        else merged.delete(id);
      }
      return merged;
    });
  }

  async function handleBulkDelete() {
    setIsBulkDeleting(true);
    try {
      const response = await fetch("/api/admin/items/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selectedIds] }),
      });
      const responseData = await response.json().catch(() => null);

      if (!response.ok) {
        toast.error(responseData?.error ?? "Não foi possível excluir os selecionados.");
        return;
      }

      setSelectedIds(new Set());
      mutate();
      toast.success(`${responseData.deletedCount} item(ns) removido(s).`);
    } catch {
      toast.error("Falha de rede ao excluir os selecionados.");
    } finally {
      setIsBulkDeleting(false);
    }
  }

  async function handleDelete(id: number) {
    const response = await fetch(`/api/admin/items/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      toast.error("Não foi possível remover o item.");
      return;
    }

    toast.success("Item removido.");
    mutate();
  }

  const filterFields: FilterFieldConfig[] = [
    {
      key: "type",
      label: "Tipo",
      type: "select",
      options: ITEM_TYPES.filter(Boolean).map((type) => ({
        value: type,
        label: type,
      })),
    },
    {
      key: "weaponType",
      label: "Tipo de arma",
      type: "select",
      options: enumOptions("weaponType", WEAPON_TYPES),
    },
    {
      key: "slotType",
      label: "Tipo de slot",
      type: "select",
      options: enumOptions("slotType", SLOT_TYPES),
    },
    {
      key: "published",
      label: "Publicado",
      type: "select",
      options: [
        { value: "true", label: "Publicado" },
        { value: "false", label: "Não publicado" },
      ],
    },
    { key: "idMin", label: "ID mínimo", type: "number" },
    { key: "idMax", label: "ID máximo", type: "number" },
    {
      key: "hasImage",
      label: "Possui imagem",
      type: "select",
      options: [
        { value: "true", label: "Sim" },
        { value: "false", label: "Não" },
      ],
    },
  ];

  const columns: ColumnDef<ItemRow>[] = [
    { accessorKey: "id", header: "ID" },
    {
      id: "image",
      header: "Sprite",
      cell: ({ row }) => (
        <EntityThumb
          entityType="item"
          id={row.original.id}
          name={row.original.name}
          image={images.get(row.original.id) ?? null}
        />
      ),
    },
    { accessorKey: "name", header: "Nome" },
    {
      accessorKey: "description",
      header: "Descrição",
      cell: ({ row }) => {
        if (!row.original.description) return "—";

        return (
          <Tooltip>
            <TooltipTrigger className="inline-flex cursor-help text-muted-foreground">
              <Info className="size-4" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">{row.original.description}</p>
            </TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      id: "types",
      header: "Tipo",
      cell: ({ row }) => {
        const { type, weaponType } = row.original;
        const typeLabel = type ? typeName("type", type) : "";
        const weaponLabel = weaponType ? typeName("weaponType", weaponType) : "";

        if (typeLabel && weaponLabel) {
          return (
            <Tooltip>
              <TooltipTrigger className="inline-flex cursor-help text-muted-foreground">
                <Info className="size-4" />
              </TooltipTrigger>
              <TooltipContent>
                <div className="flex flex-col gap-0.5">
                  <div>Tipo: {ENUM_LABELS.type[type] ?? type}</div>
                  <div>Tipo de arma: {ENUM_LABELS.weaponType[weaponType] ?? weaponType}</div>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        }

        return typeLabel || weaponLabel || "—";
      },
    },
    {
      accessorKey: "slotType",
      header: "Tipo do Slot",
      cell: ({ row }) => {
        const { slotType, containerSize } = row.original;
        if (slotType === "backpack") {
          return (
            <LabelTooltip
              label={`${typeName("slotType", slotType)} (${containerSize ?? 0} slots)`}
              hint={`${slotType} — tamanho do container: ${containerSize ?? 0}`}
            />
          );
        }
        return enumCell("slotType", slotType);
      },
    },
    {
      id: "combat",
      header: "Ataque/Defesa",
      cell: ({ row }) => (
        <CountTooltip
          count={[row.original.attack, row.original.defense, row.original.armor].filter((v) => v > 0).length}
          entries={[
            { label: "Attack", value: String(row.original.attack ?? 0) },
            { label: "Defense", value: String(row.original.defense ?? 0) },
            { label: "Arm", value: String(row.original.armor ?? 0) },
          ]}
        />
      ),
    },
    {
      id: "attributes",
      header: "Atributos",
      cell: ({ row }) => <CountTooltip entries={getAttributeEntries(row.original)} />,
    },
    {
      id: "protections",
      header: "Proteções",
      cell: ({ row }) => <CountTooltip entries={getProtectionEntries(row.original)} />,
    },
    {
      accessorKey: "weight",
      header: "Peso",
      cell: ({ row }) => formatOz(row.original.weight),
    },
    { accessorKey: "worth", header: "Valor" },
    {
      accessorKey: "published",
      header: "Publicado",
      cell: ({ row }) => (
        <PublishedToggle
          endpoint={`/api/admin/items/${row.original.id}/publish`}
          published={row.original.published}
          onToggled={() => mutate()}
          hideLabel
        />
      ),
    },    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => (
        <RowActionsMenu>
          <DropdownMenuItem render={<Link href={`/admin/items/${row.original.id}`} />}>
            <Pencil className="size-4" />
            Editar
          </DropdownMenuItem>
          <EntityImageUploadDialog
            entityType="item"
            id={row.original.id}
            name={row.original.name}
            image={images.get(row.original.id) ?? null}
            onUploaded={() => mutate()}
            trigger={
              <DropdownMenuItem>
                <ImageUp className="size-4" />
                Enviar/trocar imagem
              </DropdownMenuItem>
            }
          />
          <DropdownMenuItem render={<a href={`/api/admin/items/${row.original.id}/export`} />}>
            <Download className="size-4" />
            Exportar XML
          </DropdownMenuItem>
          <DuplicateButton
            endpoint={`/api/admin/items/${row.original.id}/duplicate`}
            editPathBase="/admin/items"
            onDuplicated={() => mutate()}
            variant="menuitem"
          />
          <DeleteRowMenuItem
            title="Remover item"
            description="Esta ação não pode ser desfeita."
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
          <h1 className="text-2xl font-semibold">Items</h1>
          <p className="text-muted-foreground">
            CRUD de items exportável para o <code>items.xml</code> do servidor.
          </p>
        </div>

        <DataTable
          columns={columns}
          data={data?.data ?? []}
          isLoading={isLoading}
          isFiltering={!isLoading && isValidating}
          searchPlaceholder="Buscar por nome ou id..."
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
          enableRowSelection
          rowSelection={rowSelectionForCurrentPage}
          onRowSelectionChange={handleRowSelectionChange}
          getRowId={(row) => String(row.id)}
          toolbar={
            <>
              {selectedIds.size > 0 && (
                <ConfirmDialog
                  trigger={
                    <Button variant="destructive" disabled={isBulkDeleting}>
                      <Trash2 className="size-4" />
                      Excluir selecionados ({selectedIds.size})
                    </Button>
                  }
                  title="Excluir items selecionados"
                  description={`Isso vai remover ${selectedIds.size} item(ns). Esta ação não pode ser desfeita.`}
                  confirmLabel="Excluir"
                  onConfirm={handleBulkDelete}
                />
              )}
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" />}>
                  <MoreVertical className="size-4" />
                  Processos
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="flex w-max min-w-56 max-w-none flex-col gap-1 p-1 [&_a]:w-full [&_a]:justify-start [&_a]:whitespace-nowrap [&_button]:w-full [&_button]:justify-start [&_button]:whitespace-nowrap"
                >
                  <DropdownMenuItem
                    disabled={selectedIds.size === 0}
                    onClick={() => setBulkEditOpen(true)}
                  >
                    <PencilLine className="size-4" />
                    Editar selecionados em massa
                    {selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
                  </DropdownMenuItem>
                  <XmlImportDialog
                    endpoint="/api/admin/items/import"
                    title="Importar items.xml"
                    description={
                      <>
                        Envie um arquivo no formato do <code>items.xml</code>{" "}
                        do OTServer. Entradas com{" "}
                        <code>fromid</code>/<code>toid</code> são expandidas
                        em um item por id. Atributos não reconhecidos são
                        preservados em &quot;Atributos extras&quot;.
                      </>
                    }
                    replaceLabel="Substituir todos os items existentes antes de importar"
                    itemLabel="item(ns)"
                    onImported={() => mutate()}
                  />
                  <ItemsXmlSyncButton onSynced={() => mutate()} />
                  <OtbSyncDialog onSynced={() => mutate()} />
                  <CopyXmlButton
                    getText={async () => {
                      const response = await fetch("/api/admin/items/export");
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
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                nativeButton={false}
                render={<Link href="/admin/items/new" />}
              >
                <Plus className="size-4" />
                Novo item
              </Button>
            </>
          }
        />
      </div>
      <BulkEditItemsDialog
        ids={[...selectedIds]}
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        onSaved={() => {
          setSelectedIds(new Set());
          mutate();
        }}
      />
    </TooltipProvider>
  );
}
