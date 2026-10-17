"use client";

import Link from "next/link";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import type { Category, TaskDefinition } from "@/lib/generated/prisma/client";
import type { PaginatedResult } from "@/lib/pagination";
import { TASK_DIFFICULTIES, TASK_DIFFICULTY_COLORS, TASK_DIFFICULTY_LABELS } from "@/lib/task-difficulty";
import { TASK_TYPE_LABELS } from "@/lib/task-type";
import { formatThousands } from "@/lib/utils";
import { useServerTable } from "@/hooks/use-server-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActionsMenu, DeleteRowMenuItem } from "@/components/shared/row-actions-menu";
import { DuplicateButton } from "@/components/shared/duplicate-button";
import { EntityThumb } from "@/components/shared/entity-thumb";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { FilterFieldConfig } from "@/components/shared/advanced-filter-panel";
import { MonsterThumbByName } from "@/components/admin/tasks/monster-thumb-by-name";
import { LooktypeThumbById } from "@/components/shared/looktype-thumb-by-id";

type TaskMonster = { name: string; kills: number };
type TaskRewards = { items?: [number, number][] };
type TaskRow = TaskDefinition & { categoryRef: Category | null };

function buildFilterFields(categories: Category[]): FilterFieldConfig[] {
  return [
  { key: "categoryId", label: "Categoria", type: "select", options: categories.map((c) => ({ value: String(c.id), label: c.name })) },
  { key: "difficulty", label: "Dificuldade", type: "select", options: TASK_DIFFICULTIES.map((d) => ({ value: d, label: TASK_DIFFICULTY_LABELS[d] })) },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "published", label: "Publicada" },
      { value: "draft", label: "Rascunho" },
    ],
  },
  { key: "levelMin", label: "Level mínimo (de)", type: "number" },
  { key: "levelMax", label: "Level mínimo (até)", type: "number" },
  { key: "killsMin", label: "Kills (de)", type: "number" },
  { key: "killsMax", label: "Kills (até)", type: "number" },
  { key: "monster", label: "Monstro", type: "text", placeholder: "Nome do monstro..." },
  { key: "item", label: "Item de recompensa", type: "text", placeholder: "Nome ou ID..." },
  ];
}

export default function AdminTasksPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating, mutate } = useSWR<PaginatedResult<TaskRow>>(
    `/api/admin/tasks?${table.buildQueryParams().toString()}`,
    fetcher,
  );
  const { data: categoriesData } = useSWR<PaginatedResult<Category>>("/api/admin/categories?pageSize=200", fetcher);
  const filterFields = buildFilterFields(categoriesData?.data ?? []);

  async function handleDelete(id: string) {
    const response = await fetch(`/api/admin/tasks/${id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Não foi possível remover.");
      return;
    }
    toast.success("Removida.");
    mutate();
  }

  const columns: ColumnDef<TaskRow>[] = [
    {
      id: "icon",
      header: "Ícone",
      cell: ({ row }) => {
        const monsters = (row.original.monsters as TaskMonster[] | null) ?? [];
        const first = monsters[0];
        if (first) return <MonsterThumbByName name={first.name} />;
        if (row.original.lookType > 0) return <LooktypeThumbById looktypeId={row.original.lookType} />;
        return <span className="text-muted-foreground">—</span>;
      },
    },
    { accessorKey: "id", header: "Slug" },
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
    {
      accessorKey: "difficulty",
      header: "Dificuldade",
      cell: ({ row }) => {
        const difficulty = row.original.difficulty as (typeof TASK_DIFFICULTIES)[number];
        const color = TASK_DIFFICULTY_COLORS[difficulty];
        const label = TASK_DIFFICULTY_LABELS[difficulty] ?? row.original.difficulty;
        return color ? (
          <Badge style={{ backgroundColor: color, color: "#fff", borderColor: color }}>{label}</Badge>
        ) : (
          <Badge variant="secondary">{label}</Badge>
        );
      },
    },
    {
      accessorKey: "type",
      header: "Tipo",
      cell: ({ row }) => {
        const label =
          TASK_TYPE_LABELS[row.original.type as keyof typeof TASK_TYPE_LABELS] ?? row.original.type;
        return <Badge variant="secondary">{label}</Badge>;
      },
    },
    { accessorKey: "levelRequired", header: "Level mín." },
    { accessorKey: "rankRequired", header: "Rank mín." },
    { accessorKey: "killsRequired", header: "Kills" },
    { accessorKey: "points", header: "Pontos" },
    {
      accessorKey: "experience",
      header: "XP de recompensa",
      cell: ({ row }) => formatThousands(row.original.experience),
    },
    {
      id: "monsters",
      header: "Monstros",
      cell: ({ row }) => {
        const monsters = (row.original.monsters as TaskMonster[] | null) ?? [];
        if (monsters.length === 0) return <span className="text-muted-foreground">—</span>;
        if (monsters.length === 1) {
          return <MonsterThumbByName name={monsters[0].name} />;
        }
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="flex cursor-help gap-1">
                    {monsters.slice(0, 3).map((m) => (
                      <MonsterThumbByName key={m.name} name={m.name} size="sm" />
                    ))}
                  </span>
                }
              />
              <TooltipContent>
                <div className="flex flex-col gap-1">
                  {monsters.map((m) => (
                    <span key={m.name}>
                      {m.name} × {m.kills}
                    </span>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },
    {
      id: "rewardItems",
      header: "Recompensas",
      cell: ({ row }) => {
        const items = (((row.original.rewards as TaskRewards | null)?.items ?? []) as [number, number][]).map(
          ([itemId, count]) => ({ itemId, count }),
        );
        if (items.length === 0) return <span className="text-muted-foreground">—</span>;
        if (items.length === 1) {
          return <EntityThumb entityType="item" id={items[0].itemId} size="32" />;
        }
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="flex cursor-help -space-x-2">
                    {items.slice(0, 3).map((item) => (
                      <EntityThumb key={item.itemId} entityType="item" id={item.itemId} size="32" />
                    ))}
                  </span>
                }
              />
              <TooltipContent>
                <div className="flex flex-col gap-1">
                  {items.map((item) => (
                    <span key={item.itemId}>
                      #{item.itemId} × {item.count}
                    </span>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
          <DropdownMenuItem render={<Link href={`/admin/tasks/${row.original.id}`} />}>
            <Pencil className="size-4" />
            Editar
          </DropdownMenuItem>
          <DuplicateButton
            endpoint={`/api/admin/tasks/${row.original.id}/duplicate`}
            editPathBase="/admin/tasks"
            variant="menuitem"
            onDuplicated={() => mutate()}
          />
          <DeleteRowMenuItem
            title="Remover task"
            description="Esta ação não pode ser desfeita. Jogadores com essa task em andamento perdem o progresso."
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
          <h1 className="text-2xl font-semibold">Tasks</h1>
          <p className="text-muted-foreground">
            Catálogo de tasks (tabela `task_definitions`) — o servidor carrega esta tabela
            diretamente e a recarrega periodicamente, então mudanças aqui refletem no jogo sem
            precisar reiniciar ou editar Lua.
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isFiltering={!isLoading && isValidating}
        searchPlaceholder="Buscar task..."
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
          <Button nativeButton={false} render={<Link href="/admin/tasks/new" />}>
            <Plus className="size-4" />
            Nova
          </Button>
        }
      />
    </div>
  );
}
