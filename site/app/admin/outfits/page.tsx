"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, FileCode, FileCog, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import type { OutfitRow } from "@/lib/outfit-mapper";
import { outfitToXml, outfitsToXmlDocument } from "@/lib/outfit-xml";
import { OUTFIT_UNLOCK_SCRIPT_NAME } from "@/lib/outfit-lua";
import { useServerTable } from "@/hooks/use-server-table";
import { useCrossPageSelection } from "@/hooks/use-cross-page-selection";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RowActionsMenu, DeleteRowMenuItem } from "@/components/shared/row-actions-menu";
import { CopyXmlButton } from "@/components/shared/copy-xml-button";
import { XmlImportDialog } from "@/components/shared/xml-import-dialog";
import { EntityThumb } from "@/components/shared/entity-thumb";
import { LooktypeAnimatedImage } from "@/components/shared/looktype-animated-image";
import { GeneratedCodeDialog, downloadText } from "@/components/shared/generated-code-dialog";
import type { FilterFieldConfig } from "@/components/shared/advanced-filter-panel";

const YES_NO = [
  { value: "true", label: "Sim" },
  { value: "false", label: "Não" },
];

export default function AdminOutfitsPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating, mutate } = useSWR<PaginatedResult<OutfitRow>>(
    `/api/admin/outfits?${table.buildQueryParams().toString()}`,
    fetcher,
  );

  const selection = useCrossPageSelection(data?.data);
  const selectedCount = selection.selectedIds.size;
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  function selectedIdsQuery() {
    return selectedCount > 0 ? `ids=${[...selection.selectedIds].join(",")}` : "";
  }

  async function loadXml() {
    const response = await fetch(`/api/admin/outfits/export?inline=1&${selectedIdsQuery()}`);
    if (!response.ok) throw new Error();
    return [
      { title: "outfits.xml", filename: "outfits.xml", language: "xml" as const, text: await response.text() },
    ];
  }

  async function loadLua() {
    const response = await fetch(`/api/admin/outfits/lua?${selectedIdsQuery()}`);
    if (!response.ok) throw new Error();
    const result: { count: number; lua: string; actionsXml: string } = await response.json();
    return [
      {
        title: `data/actions/scripts/${OUTFIT_UNLOCK_SCRIPT_NAME} (${result.count} item(ns))`,
        filename: OUTFIT_UNLOCK_SCRIPT_NAME,
        language: "lua" as const,
        text: result.lua,
      },
      {
        title: "Trecho para data/actions/actions.xml",
        filename: "outfit_item_unlock_actions.xml",
        language: "xml" as const,
        text: result.actionsXml || "<!-- Nenhuma outfit com item de desbloqueio configurado. -->",
      },
    ];
  }

  async function handleDelete(id: number) {
    const response = await fetch(`/api/admin/outfits/${id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Não foi possível remover a outfit.");
      return;
    }
    toast.success("Outfit removida.");
    mutate();
  }

  async function handleBulkDelete() {
    setIsBulkDeleting(true);
    try {
      const response = await fetch("/api/admin/outfits/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selection.selectedIds] }),
      });
      const responseData = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(responseData?.error ?? "Não foi possível excluir as selecionadas.");
        return;
      }
      selection.clearSelection();
      mutate();
      toast.success(`${responseData.deletedCount} outfit(s) removida(s).`);
    } finally {
      setIsBulkDeleting(false);
    }
  }

  const filterFields: FilterFieldConfig[] = [
    { key: "premium", label: "Premium", type: "select", options: YES_NO },
    { key: "hasStorage", label: "Possui storage", type: "select", options: YES_NO },
    { key: "hasItem", label: "Liberada por item", type: "select", options: YES_NO },
  ];

  const columns: ColumnDef<OutfitRow>[] = [
    { accessorKey: "id", header: "ID" },
    {
      id: "preview",
      header: "Preview",
      cell: ({ row }) => (
        <LooktypeAnimatedImage
          looktypeId={row.original.maleLooktype.id}
          frameCount={row.original.maleLooktype.frameCount}
          frameDurationsMs={row.original.maleLooktype.frameDurationsMs}
          updatedAt={row.original.maleLooktype.updatedAt}
          size="sm"
        />
      ),
    },
    { accessorKey: "name", header: "Nome" },
    {
      id: "looktypes",
      header: "Looktype (M / F)",
      cell: ({ row }) => {
        const { maleLooktypeNumber, femaleLooktypeNumber } = row.original;
        return maleLooktypeNumber === femaleLooktypeNumber
          ? maleLooktypeNumber
          : `${maleLooktypeNumber} / ${femaleLooktypeNumber}`;
      },
    },
    {
      id: "storage",
      header: "Storage",
      cell: ({ row }) =>
        row.original.storageId ? (
          <span className="font-mono text-xs">
            {row.original.storageId} ≥ {row.original.storageValue || "—"}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "premium",
      header: "Premium",
      cell: ({ row }) => (
        <Badge variant={row.original.premium ? "default" : "secondary"}>
          {row.original.premium ? "Sim" : "Não"}
        </Badge>
      ),
    },
    {
      id: "item",
      header: "Item",
      cell: ({ row }) =>
        row.original.unlockItemId > 0 ? (
          <span className="flex items-center gap-2">
            <EntityThumb
              entityType="item"
              id={row.original.unlockItemId}
              name={row.original.unlockItemName ?? undefined}
              size="32"
            />
            <span className="text-sm">
              {row.original.unlockItemName ?? "?"} (#{row.original.unlockItemId})
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => (
        <RowActionsMenu>
          <DropdownMenuItem render={<Link href={`/admin/outfits/${row.original.id}`} />}>
            <Pencil className="size-4" />
            Editar
          </DropdownMenuItem>
          <CopyXmlButton variant="menuitem" label="Copiar XML" getText={() => outfitToXml(row.original)} />
          <DropdownMenuItem
            onClick={() =>
              downloadText(outfitsToXmlDocument([row.original]), `outfit_${row.original.id}.xml`)
            }
          >
            <Download className="size-4" />
            Baixar XML
          </DropdownMenuItem>
          <DeleteRowMenuItem
            title="Remover outfit"
            description="Esta ação não pode ser desfeita."
            confirmLabel="Remover"
            onConfirm={() => handleDelete(row.original.id)}
          />
        </RowActionsMenu>
      ),
    },
  ];

  const scopeLabel = selectedCount > 0 ? `${selectedCount} selecionada(s)` : "todas";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Outfits</h1>
        <p className="text-muted-foreground">
          Outfits do <code>data/XML/outfits.xml</code> com as aparências do cadastro de looktypes e o
          item que libera cada outfit. Selecione registros para gerar o XML/Lua só deles.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isFiltering={!isLoading && isValidating}
        searchPlaceholder="Buscar por nome, id, looktype ou item..."
        searchValue={table.searchInput}
        onSearchChange={table.handleSearchChange}
        filters={filterFields}
        filterValues={table.draftFilters}
        onFilterValuesChange={table.setDraftFilters}
        onApplyFilters={table.applyFilters}
        onClearFilters={table.clearFilters}
        enableRowSelection
        rowSelection={selection.rowSelection}
        onRowSelectionChange={selection.onRowSelectionChange}
        getRowId={(row) => String(row.id)}
        manualPagination
        pageIndex={table.pageIndex}
        pageSize={table.pageSize}
        pageCount={data?.pageCount ?? 1}
        totalCount={data?.total}
        onPageChange={table.setPageIndex}
        onPageSizeChange={table.setPageSize}
        toolbar={
          <>
            {selectedCount > 0 && (
              <>
                <Button variant="ghost" onClick={selection.clearSelection}>
                  Limpar seleção
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button variant="destructive" disabled={isBulkDeleting}>
                      <Trash2 className="size-4" />
                      Excluir ({selectedCount})
                    </Button>
                  }
                  title="Excluir outfits selecionadas"
                  description={`Isso vai remover ${selectedCount} outfit(s). As looktypes do cadastro são mantidas. Esta ação não pode ser desfeita.`}
                  confirmLabel="Excluir"
                  onConfirm={handleBulkDelete}
                />
              </>
            )}
            <XmlImportDialog
              endpoint="/api/admin/outfits/import"
              title="Importar outfits.xml"
              description={
                <>
                  Envie o <code>data/XML/outfits.xml</code> do servidor. As looktypes de cada{" "}
                  <code>&lt;list&gt;</code> são buscadas no cadastro de looktypes (tipo Outfit) pelo
                  número e criadas automaticamente quando não existirem. O item de desbloqueio das
                  outfits já cadastradas é preservado.
                </>
              }
              replaceLabel="Substituir outfits já cadastradas (mesmo id)"
              itemLabel="outfit(s)"
              formatSuccess={(result) =>
                `${result.imported} outfit(s) importada(s)` +
                (result.createdLooktypes ? `, ${result.createdLooktypes} looktype(s) criada(s)` : "") +
                (result.skipped ? `, ${result.skipped} ignorada(s)` : "") +
                "."
              }
              onImported={() => mutate()}
            />
            <GeneratedCodeDialog
              title={`Gerar outfits.xml (${scopeLabel})`}
              description="Copie o conteúdo ou baixe o arquivo para data/XML/outfits.xml."
              load={loadXml}
              trigger={
                <Button variant="outline">
                  <FileCode className="size-4" />
                  Gerar XML ({scopeLabel})
                </Button>
              }
            />
            <GeneratedCodeDialog
              title={`Script de itens (${scopeLabel})`}
              description={
                <>
                  Salve o Lua em <code>data/actions/scripts/{OUTFIT_UNLOCK_SCRIPT_NAME}</code> e
                  registre as linhas no <code>data/actions/actions.xml</code>. Outfits liberadas por
                  item devem usar storage vazio ou próprio — o storage 59000+vocação é controlado
                  pelo sistema de sagas.
                </>
              }
              load={loadLua}
              trigger={
                <Button variant="outline">
                  <FileCog className="size-4" />
                  Script Lua dos itens
                </Button>
              }
            />
            <Button nativeButton={false} render={<Link href="/admin/outfits/new" />}>
              <Plus className="size-4" />
              Nova outfit
            </Button>
          </>
        }
      />
    </div>
  );
}
