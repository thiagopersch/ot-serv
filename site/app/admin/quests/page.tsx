"use client";

import Link from "next/link";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import type { Category, Quest } from "@/lib/generated/prisma/client";
import type { PaginatedResult } from "@/lib/pagination";
import type { QuestRewardItem } from "@/lib/validations/admin/quest";
import { useServerTable } from "@/hooks/use-server-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActionsMenu, DeleteRowMenuItem } from "@/components/shared/row-actions-menu";
import { DuplicateButton } from "@/components/shared/duplicate-button";
import { EntityThumb } from "@/components/shared/entity-thumb";

type QuestRow = Quest & { categoryRef: Category | null };

export default function AdminQuestsPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating, mutate } = useSWR<PaginatedResult<QuestRow>>(
    `/api/admin/quests?${table.buildQueryParams().toString()}`,
    fetcher,
  );

  async function handleDelete(id: number) {
    const response = await fetch(`/api/admin/quests/${id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Não foi possível remover.");
      return;
    }
    toast.success("Removida.");
    mutate();
  }

  const columns: ColumnDef<QuestRow>[] = [
    {
      id: "image",
      header: "Imagem",
      cell: ({ row }) =>
        row.original.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- thumbnail pequena, servida estática de public/storage
          <img
            src={row.original.imageUrl}
            alt=""
            className="size-10 shrink-0 rounded-sm border border-border object-cover"
          />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    { accessorKey: "name", header: "Nome" },
    {
      id: "category",
      header: "Categoria",
      cell: ({ row }) =>
        row.original.categoryRef ? (
          <Badge
            style={{
              backgroundColor: row.original.categoryRef.color,
              color: "#fff",
              borderColor: row.original.categoryRef.color,
            }}
          >
            {row.original.categoryRef.name}
          </Badge>
        ) : (
          <span className="text-muted-foreground">{row.original.category}</span>
        ),
    },
    { accessorKey: "levelRequired", header: "Level mínimo" },
    {
      id: "rewardItems",
      header: "Recompensas",
      cell: ({ row }) => {
        const items = (row.original.rewardItems as QuestRewardItem[] | null) ?? [];
        if (items.length === 0) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="flex items-center gap-1">
            {items.map((item) => (
              <EntityThumb key={item.itemId} entityType="item" id={item.itemId} size="32" />
            ))}
          </div>
        );
      },
    },
    {
      accessorKey: "published",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.published ? "default" : "secondary"}>
          {row.original.published ? "Publicada" : "Rascunho"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => (
        <RowActionsMenu>
          <DropdownMenuItem render={<Link href={`/admin/quests/${row.original.id}`} />}>
            <Pencil className="size-4" />
            Editar
          </DropdownMenuItem>
          <DuplicateButton
            endpoint={`/api/admin/quests/${row.original.id}/duplicate`}
            editPathBase="/admin/quests"
            variant="menuitem"
            onDuplicated={() => mutate()}
          />
          <DeleteRowMenuItem
            title="Remover quest"
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Quests</h1>
          <p className="text-muted-foreground">
            Catálogo de quests (tabela `quests`). A lógica de conclusão de cada quest continua
            sendo escrita em scripts do servidor (via `QuestLib.completeQuest`) — este cadastro
            define nome, descrição, requisitos e recompensas.
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isFiltering={!isLoading && isValidating}
        searchPlaceholder="Buscar quest..."
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
          <Button nativeButton={false} render={<Link href="/admin/quests/new" />}>
            <Plus className="size-4" />
            Nova
          </Button>
        }
      />
    </div>
  );
}
