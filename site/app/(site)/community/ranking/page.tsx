"use client";

import Link from "next/link";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { Info } from "lucide-react";

import { fetcher } from "@/lib/fetcher";
import { formatThousands } from "@/lib/utils";
import type { PaginatedResult } from "@/lib/pagination";
import { useServerTable } from "@/hooks/use-server-table";
import { DataTable } from "@/components/shared/data-table";
import type { FilterFieldConfig } from "@/components/shared/advanced-filter-panel";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type RankingPlayer = {
  id: number;
  name: string;
  vocationName: string;
  experience: string;
  online: number;
  rankValue: number;
  skill: string;
  missingPercentage: number | null;
};

const SKILL_OPTIONS = [
  { value: "level", label: "Level" },
  { value: "maglevel", label: "Magic level" },
  { value: "resets", label: "Resets" },
  { value: "fist", label: "Fist" },
  { value: "club", label: "Club" },
  { value: "sword", label: "Sword" },
  { value: "axe", label: "Axe (Glove)" },
  { value: "distance", label: "Distance" },
  { value: "shielding", label: "Shielding" },
  { value: "fishing", label: "Fishing" },
];

const filterFields: FilterFieldConfig[] = [
  { key: "skill", label: "Ranquear por", type: "select", options: SKILL_OPTIONS },
];

function buildColumns(skill: string): ColumnDef<RankingPlayer>[] {
  const isLevelRanking = skill === "level";

  return [
    {
      accessorKey: "name",
      header: "Nome",
      cell: ({ row }) => (
        <Link
          href={`/community/characters/${encodeURIComponent(row.original.name)}`}
          className={
            row.original.online
              ? "font-medium text-green-600 hover:underline dark:text-green-400"
              : "font-medium text-red-600 hover:underline dark:text-red-400"
          }
        >
          {row.original.name}
        </Link>
      ),
    },
    { accessorKey: "rankValue", header: "Level" },
    { accessorKey: "vocationName", header: "Vocação" },
    {
      accessorKey: "experience",
      header: () =>
        isLevelRanking ? (
          "Experiência"
        ) : (
          <TooltipProvider>
            <span className="inline-flex items-center gap-1">
              Porcentagem faltante
              <Tooltip>
                <TooltipTrigger render={<Info className="size-3.5 cursor-help text-muted-foreground" />} />
                <TooltipContent>
                  Porcentagem que falta para avançar para o próximo nível dessa skill.
                </TooltipContent>
              </Tooltip>
            </span>
          </TooltipProvider>
        ),
      cell: ({ row }) => {
        if (isLevelRanking) {
          return formatThousands(row.original.experience);
        }
        if (row.original.skill === "resets") {
          return "--";
        }
        return `${row.original.missingPercentage ?? 0}%`;
      },
    },
  ];
}

export default function RankingPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating } = useSWR<PaginatedResult<RankingPlayer>>(
    `/api/public/ranking?${table.buildQueryParams().toString()}`,
    fetcher
  );

  const currentSkill = (table.appliedFilters.skill as string) ?? "level";
  const columns = buildColumns(currentSkill);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Ranking</h1>
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isFiltering={!isLoading && isValidating}
        searchPlaceholder="Buscar jogador..."
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
      />
    </div>
  );
}
