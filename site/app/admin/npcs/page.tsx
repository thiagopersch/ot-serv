"use client";

import Link from "next/link";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import { NPC_TYPES } from "@/lib/validations/admin/npc";
import { textColorFor } from "@/lib/color-utils";
import { useServerTable } from "@/hooks/use-server-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActionsMenu, DeleteRowMenuItem } from "@/components/shared/row-actions-menu";
import { OutfitColorThumbById } from "@/components/shared/outfit-color-thumb-by-id";
import { NpcShopItemsPreview } from "@/components/admin/npcs/npc-shop-items-preview";
import type { FilterFieldConfig } from "@/components/shared/advanced-filter-panel";

type NpcCategoryRow = { id: number; name: string; color: string };

type NpcRow = {
  id: number;
  name: string;
  type: string;
  lookTypeId: number;
  direction: number;
  lookHead: number;
  lookBody: number;
  lookLegs: number;
  lookFeet: number;
  lookAddons: number;
  town: string;
  published: boolean;
  shopItems: unknown;
  category: { id: number; name: string; color: string } | null;
};

export default function AdminNpcsPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating, mutate } = useSWR<PaginatedResult<NpcRow>>(
    `/api/admin/npcs?${table.buildQueryParams().toString()}`,
    fetcher,
  );

  const { data: categoriesData } = useSWR<PaginatedResult<NpcCategoryRow>>(
    "/api/admin/npc-categories?pageSize=200",
    fetcher,
  );

  async function handleDelete(id: number) {
    const response = await fetch(`/api/admin/npcs/${id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Não foi possível remover.");
      return;
    }
    toast.success("NPC removido.");
    mutate();
  }

  const filterFields: FilterFieldConfig[] = [
    {
      key: "type",
      label: "Tipo",
      type: "select",
      options: NPC_TYPES.map((type) => ({ value: type, label: type })),
    },
    {
      key: "direction",
      label: "Direção",
      type: "select",
      options: [
        { value: "0", label: "Norte" },
        { value: "1", label: "Leste" },
        { value: "2", label: "Sul" },
        { value: "3", label: "Oeste" },
      ],
    },
    {
      key: "lookAddons",
      label: "Addons",
      type: "select",
      options: [
        { value: "0", label: "Nenhum" },
        { value: "1", label: "Addon 1" },
        { value: "2", label: "Addon 2" },
        { value: "3", label: "Ambos" },
      ],
    },
    {
      key: "categoryId",
      label: "Categoria",
      type: "select",
      options: (categoriesData?.data ?? []).map((cat) => ({ value: String(cat.id), label: cat.name })),
    },
    {
      key: "published",
      label: "Publicado",
      type: "select",
      options: [
        { value: "true", label: "Sim" },
        { value: "false", label: "Não" },
      ],
    },
  ];

  const columns: ColumnDef<NpcRow>[] = [
    {
      id: "image",
      header: "Imagem",
      cell: ({ row }) =>
        row.original.lookTypeId > 0 ? (
          <OutfitColorThumbById
            looktypeId={row.original.lookTypeId}
            direction={row.original.direction}
            addons={row.original.lookAddons}
            headColor={row.original.lookHead}
            bodyColor={row.original.lookBody}
            legsColor={row.original.lookLegs}
            feetColor={row.original.lookFeet}
            size="md"
          />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    { accessorKey: "name", header: "Nome" },
    { accessorKey: "type", header: "Tipo" },
    {
      id: "category",
      header: "Categoria",
      cell: ({ row }) =>
        row.original.category ? (
          <Badge
            style={{
              backgroundColor: row.original.category.color,
              color: textColorFor(row.original.category.color),
              borderColor: row.original.category.color,
            }}
          >
            {row.original.category.name}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    { accessorKey: "town", header: "Cidade" },
    {
      id: "buyItems",
      header: "Compra",
      cell: ({ row }) => <NpcShopItemsPreview items={row.original.shopItems} direction="buy" />,
    },
    {
      id: "sellItems",
      header: "Venda",
      cell: ({ row }) => <NpcShopItemsPreview items={row.original.shopItems} direction="sell" />,
    },
    {
      accessorKey: "published",
      header: "Publicado",
      cell: ({ row }) => (row.original.published ? "Sim" : "Não"),
    },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => (
        <RowActionsMenu>
          <DropdownMenuItem render={<Link href={`/admin/npcs/${row.original.id}`} />}>
            <Pencil className="size-4" />
            Editar
          </DropdownMenuItem>
          <DeleteRowMenuItem
            title="Remover"
            description="Remove o NPC do banco e os arquivos gerados (data/npc/{nome}.xml)."
            confirmLabel="Remover"
            onConfirm={() => handleDelete(row.original.id)}
          />
        </RowActionsMenu>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">NPCs</h1>
          <p className="text-muted-foreground">
            Gera data/npc/{"{nome}"}.xml (+ script quando aplicável) no servidor.
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isFiltering={!isLoading && isValidating}
        searchPlaceholder="Nome, looktype, item (nome ou id)..."
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
          <Link href="/admin/npcs/new">
            <Button>
              <Plus className="size-4" />
              Novo
            </Button>
          </Link>
        }
      />
    </div>
  );
}
