"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import dayjs from "dayjs";

import { fetcher } from "@/lib/fetcher";
import type { Looktype } from "@/lib/generated/prisma/client";
import type { PaginatedResult } from "@/lib/pagination";
import {
  LOOKTYPE_CATEGORIES,
  LOOKTYPE_CATEGORY_LABELS,
  spriteTermFor,
  type LooktypeCategory,
} from "@/lib/validations/admin/looktype";
import { useServerTable } from "@/hooks/use-server-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActionsMenu, DeleteRowMenuItem } from "@/components/shared/row-actions-menu";
import { LooktypeAnimatedImage } from "@/components/shared/looktype-animated-image";
import { LooktypeCreateDialog } from "@/components/admin/looktypes/looktype-create-dialog";
import { LooktypeImportClientDialog } from "@/components/admin/looktypes/looktype-import-client-dialog";
import type { FilterFieldConfig } from "@/components/shared/advanced-filter-panel";

type FacetsResponse = {
  frameCounts: number[];
  sizes: { width: number; height: number }[];
  speeds: number[];
};

export default function AdminLooktypesPage() {
  const table = useServerTable();

  const { data: facets } = useSWR<FacetsResponse>("/api/admin/looktypes/facets", fetcher);

  const { data, isLoading, isValidating, mutate } = useSWR<PaginatedResult<Looktype>>(
    `/api/admin/looktypes?${table.buildQueryParams().toString()}`,
    fetcher
  );

  // Ids selecionados atravessando páginas — sobrevive à troca de página sozinho, já que trocar de
  // página só troca a query do SWR acima (não desmonta a página nem a tabela). A tabela só recebe
  // (e só sabe alterar) a fatia desse conjunto que corresponde às linhas da página atual.
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

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
      const response = await fetch("/api/admin/looktypes/bulk-delete", {
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

      if (responseData.skippedCount > 0) {
        toast.success(`${responseData.deletedCount} sprite(s) removida(s).`);
        toast.error(`${responseData.skippedCount} não foram removidas por estarem vinculadas a algo (item/monstro/npc/vocação/spell/outfit).`);
      } else {
        toast.success(`${responseData.deletedCount} sprite(s) removida(s).`);
      }
    } catch {
      toast.error("Falha de rede ao excluir os selecionados.");
    } finally {
      setIsBulkDeleting(false);
    }
  }

  const filterFields: FilterFieldConfig[] = [
    {
      key: "category",
      label: "Tipo",
      type: "select",
      options: LOOKTYPE_CATEGORIES.map((category) => ({
        value: category,
        label: LOOKTYPE_CATEGORY_LABELS[category],
      })),
    },
    {
      key: "frameCount",
      label: "Frames",
      type: "select",
      options: (facets?.frameCounts ?? []).map((frameCount) => ({
        value: String(frameCount),
        label: String(frameCount),
      })),
    },
    {
      key: "size",
      label: "Tamanho (largura x altura)",
      type: "select",
      options: (facets?.sizes ?? []).map(({ width, height }) => ({
        value: `${width}x${height}`,
        label: `${width * 32}x${height * 32}`,
      })),
    },
    {
      key: "frameSpeedMs",
      label: "Velocidade (ms)",
      type: "select",
      options: (facets?.speeds ?? []).map((speed) => ({
        value: String(speed),
        label: String(speed),
      })),
    },
  ];

  async function handleDelete(id: number) {
    const response = await fetch(`/api/admin/looktypes/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const responseData = await response.json().catch(() => null);
      toast.error(responseData?.error ?? "Não foi possível remover.");
      return;
    }
    toast.success("Removido.");
    mutate();
  }

  const columns: ColumnDef<Looktype>[] = [
    { accessorKey: "id", header: "ID" },
    {
      id: "preview",
      header: "Preview",
      cell: ({ row }) => (
        <LooktypeAnimatedImage
          looktypeId={row.original.id}
          frameCount={row.original.frameCount}
          frameDurationsMs={row.original.frameDurationsMs as number[]}
          updatedAt={row.original.updatedAt}
          size="sm"
        />
      ),
    },
    { accessorKey: "name", header: "Nome" },
    {
      accessorKey: "category",
      header: "Tipo",
      cell: ({ row }) => {
        const category = row.original.category as LooktypeCategory;
        return (
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary">{LOOKTYPE_CATEGORY_LABELS[category] ?? category}</Badge>
            <span className="text-xs text-muted-foreground">({spriteTermFor(category)})</span>
          </div>
        );
      },
    },
    {
      accessorKey: "looktypeNumber",
      header: "Número",
      cell: ({ row }) => row.original.looktypeNumber ?? <span className="text-muted-foreground">—</span>,
    },
    { accessorKey: "frameCount", header: "Frames" },
    {
      id: "size",
      header: "Tamanho (px)",
      cell: ({ row }) => `${row.original.width * 32}x${row.original.height * 32}`,
    },
    {
      id: "frameSpeedMs",
      header: "Velocidade (ms)",
      cell: ({ row }) => {
        const durations = row.original.frameDurationsMs as number[];
        return durations.length > 0 ? durations[0] : <span className="text-muted-foreground">—</span>;
      },
    },
    {
      accessorKey: "updatedAt",
      header: "Atualizado em",
      cell: ({ row }) => dayjs(row.original.updatedAt).format("DD/MM/YYYY HH:mm"),
    },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => (
        <RowActionsMenu>
          <DropdownMenuItem render={<Link href={`/admin/looktypes/${row.original.id}`} />}>
            <Pencil className="size-4" />
            Editar
          </DropdownMenuItem>
          <DeleteRowMenuItem
            title="Remover"
            description="Esta ação não pode ser desfeita e remove os frames em disco."
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
        <h1 className="text-2xl font-semibold">Sprites</h1>
        <p className="text-muted-foreground">
          Registro centralizado de aparências (item/outfit/monstro/npc/vocação/efeito/missile) — importe um
          `.obd` do Object Builder para gerar a animação automaticamente, ou uma imagem PNG/GIF estática.
          &quot;Looktype&quot; é o termo usado só para outfits; os demais tipos são chamados de &quot;Sprite&quot;.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isFiltering={!isLoading && isValidating}
        searchPlaceholder="Buscar por nome, id ou número..."
        searchValue={table.searchInput}
        onSearchChange={table.handleSearchChange}
        filters={filterFields}
        filterValues={table.draftFilters}
        onFilterValuesChange={table.setDraftFilters}
        onApplyFilters={table.applyFilters}
        onClearFilters={table.clearFilters}
        toolbar={
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <ConfirmDialog
                trigger={
                  <Button variant="destructive" disabled={isBulkDeleting}>
                    <Trash2 className="size-4" />
                    Excluir selecionados ({selectedIds.size})
                  </Button>
                }
                title="Excluir sprites selecionadas"
                description={`Isso vai remover ${selectedIds.size} sprite(s) (registro e frames em disco). Looktypes vinculados a algo (item/monstro/npc/vocação/spell/outfit) são pulados automaticamente. Esta ação não pode ser desfeita.`}
                confirmLabel="Excluir"
                onConfirm={handleBulkDelete}
              />
            )}
            <LooktypeImportClientDialog
              onImported={() => mutate()}
              trigger={<Button variant="outline">Importar do cliente</Button>}
            />
            <LooktypeCreateDialog onCreated={() => mutate()} trigger={<Button>Nova sprite / looktype</Button>} />
          </div>
        }
        enableRowSelection
        rowSelection={rowSelectionForCurrentPage}
        onRowSelectionChange={handleRowSelectionChange}
        getRowId={(row) => String(row.id)}
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
