"use client";

import Link from "next/link";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import type { BattlePassSeason } from "@/lib/generated/prisma/client";
import type { PaginatedResult } from "@/lib/pagination";
import { MONTH_NAMES } from "@/lib/month-names";
import {
  BATTLE_PASS_MISSION_TYPES,
  BATTLE_PASS_MISSION_TYPE_LABELS,
  BATTLE_PASS_RARITIES,
  BATTLE_PASS_RARITY_LABELS,
  BATTLE_PASS_TRACKS,
  BATTLE_PASS_TRACK_LABELS,
} from "@/lib/validations/admin/battle-pass";
import { useServerTable } from "@/hooks/use-server-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActionsMenu, DeleteRowMenuItem } from "@/components/shared/row-actions-menu";
import { DuplicateButton } from "@/components/shared/duplicate-button";
import { EntityThumb } from "@/components/shared/entity-thumb";
import { useItemName } from "@/components/shared/use-item-name";
import type { FilterFieldConfig } from "@/components/shared/advanced-filter-panel";

type SeasonRow = BattlePassSeason & { _count: { missions: number; rewards: number } };

function ItemCostCell({ itemId, cost }: { itemId: number; cost: number }) {
  const name = useItemName(itemId || null);

  if (!itemId) return <span className="text-muted-foreground">—</span>;

  return (
    <span className="flex items-center gap-2">
      <EntityThumb entityType="item" id={itemId} name={name ?? undefined} size="32" />
      <span className="flex flex-col">
        <span className="text-sm">{name ?? `#${itemId}`}</span>
        <span className="text-xs text-muted-foreground">{cost}</span>
      </span>
    </span>
  );
}

const filterFields: FilterFieldConfig[] = [
  {
    key: "hasImage",
    label: "Possui imagem (passe/level)",
    type: "select",
    options: [
      { value: "true", label: "Sim" },
      { value: "false", label: "Não" },
    ],
  },
  { key: "maxLevel", label: "Level máximo", type: "number" },
  { key: "xpPerLevel", label: "XP por level", type: "number" },
  { key: "goldPassCost", label: "Custo do passe GOLD", type: "number" },
  { key: "levelPurchaseCost", label: "Custo para comprar 1 level", type: "number" },
  {
    key: "missionType",
    label: "Tipo de missão cadastrada",
    type: "select",
    options: BATTLE_PASS_MISSION_TYPES.map((type) => ({
      value: type,
      label: BATTLE_PASS_MISSION_TYPE_LABELS[type],
    })),
  },
  { key: "monster", label: "Monstro cadastrado", type: "text", placeholder: "Nome do monstro..." },
  { key: "vocation", label: "Vocação (id)", type: "text", placeholder: "ID da vocação..." },
  {
    key: "rewardRarity",
    label: "Raridade das recompensas",
    type: "select",
    options: BATTLE_PASS_RARITIES.map((rarity) => ({ value: rarity, label: BATTLE_PASS_RARITY_LABELS[rarity] })),
  },
  {
    key: "track",
    label: "Trilha",
    type: "select",
    options: BATTLE_PASS_TRACKS.map((track) => ({ value: track, label: BATTLE_PASS_TRACK_LABELS[track] })),
  },
  { key: "rewardItem", label: "Item de recompensa", type: "text", placeholder: "Nome ou ID do item..." },
];

export default function AdminBattlePassPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating, mutate } = useSWR<PaginatedResult<SeasonRow>>(
    `/api/admin/battle-pass/seasons?${table.buildQueryParams().toString()}`,
    fetcher,
  );

  const seasons = data?.data ?? [];

  async function handleDelete(id: number) {
    const response = await fetch(`/api/admin/battle-pass/seasons/${id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Não foi possível remover.");
      return;
    }
    toast.success("Temporada removida.");
    mutate();
  }

  const columns: ColumnDef<SeasonRow>[] = [
    {
      id: "monthYear",
      header: "Mês/Ano",
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          {MONTH_NAMES[row.original.month - 1]}/{row.original.year}
          {row.original.isActive && <Badge variant="default">Vigente</Badge>}
        </span>
      ),
    },
    {
      id: "maxLevel",
      header: "Level máximo",
      cell: ({ row }) => row.original.maxLevel,
    },
    {
      id: "xpPerLevel",
      header: "XP por level",
      cell: ({ row }) => row.original.xpPerLevel,
    },
    {
      id: "goldPassCost",
      header: "Custo do passe GOLD",
      cell: ({ row }) => (
        <ItemCostCell itemId={row.original.goldPassItemId} cost={row.original.goldPassCost} />
      ),
    },
    {
      id: "levelPurchaseCost",
      header: "Custo por 1 level",
      cell: ({ row }) => (
        <ItemCostCell itemId={row.original.levelPurchaseItemId} cost={row.original.levelPurchaseCost} />
      ),
    },
    {
      id: "missionCount",
      header: "Qtd. missões",
      cell: ({ row }) => row.original._count.missions,
    },
    {
      id: "rewardCount",
      header: "Qtd. recompensas",
      cell: ({ row }) => row.original._count.rewards,
    },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => (
        <RowActionsMenu>
          <DropdownMenuItem render={<Link href={`/admin/battle-pass/${row.original.id}`} />}>
            <Pencil className="size-4" />
            Editar
          </DropdownMenuItem>
          <DuplicateButton
            endpoint={`/api/admin/battle-pass/seasons/${row.original.id}/duplicate`}
            editPathBase="/admin/battle-pass"
            variant="menuitem"
            onDuplicated={() => mutate()}
          />
          <DeleteRowMenuItem
            title="Remover"
            description="Esta ação não pode ser desfeita. Missões e recompensas dessa temporada também serão removidas."
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
        <h1 className="text-2xl font-semibold">Battle Pass</h1>
        <p className="text-muted-foreground">
          Temporadas do battle pass. Apenas a temporada cujo mês/ano bate com a data atual fica
          vigente para os jogadores — as demais servem de histórico ou planejamento futuro.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={seasons}
        isLoading={isLoading}
        isFiltering={!isLoading && isValidating}
        searchPlaceholder="Buscar por mês ou ano..."
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
          <Button nativeButton={false} render={<Link href="/admin/battle-pass/new" />}>
            <Plus className="size-4" />
            Nova
          </Button>
        }
      />
    </div>
  );
}
