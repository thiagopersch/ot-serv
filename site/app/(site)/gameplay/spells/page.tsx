"use client";

import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import { SPELL_GROUP_OPTIONS } from "@/lib/validations/admin/spell";
import type { EntityImageInfo } from "@/components/shared/use-entity-images";
import { useServerTable } from "@/hooks/use-server-table";
import { DataTable } from "@/components/shared/data-table";
import { EntityThumb } from "@/components/shared/entity-thumb";
import type { FilterFieldConfig } from "@/components/shared/advanced-filter-panel";

type PublicVocation = { id: number; name: string };

type PublicSpell = {
  id: number;
  name: string;
  level: number;
  mana: number;
  description: string;
  vocationNames: string[];
  image: EntityImageInfo | null;
};

const columns: ColumnDef<PublicSpell>[] = [
  {
    accessorKey: "image",
    header: "",
    cell: ({ row }) => (
      <EntityThumb
        entityType="spell"
        id={row.original.id}
        name={row.original.name}
        image={row.original.image}
      />
    ),
  },
  { accessorKey: "name", header: "Nome" },
  { accessorKey: "level", header: "Level" },
  { accessorKey: "mana", header: "Mana" },
  {
    accessorKey: "vocationNames",
    header: "Vocações",
    cell: ({ row }) => (
      <span>{row.original.vocationNames.join(", ") || "—"}</span>
    ),
  },
  {
    accessorKey: "description",
    header: "Descrição",
    cell: ({ row }) => (
      <span className="block max-w-xs min-w-48 text-wrap whitespace-normal break-words">
        {row.original.description || "—"}
      </span>
    ),
  },
];

export default function PublicSpellsPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating } = useSWR<
    PaginatedResult<PublicSpell>
  >(`/api/public/spells?${table.buildQueryParams().toString()}`, fetcher);

  const { data: vocationsData } = useSWR<PaginatedResult<PublicVocation>>(
    "/api/public/vocations?pageSize=200",
    fetcher,
  );

  const filterFields: FilterFieldConfig[] = [
    { key: "levelMax", label: "Level (até)", type: "number" },
    {
      key: "vocationId",
      label: "Vocação",
      type: "select",
      options: (vocationsData?.data ?? []).map((vocation) => ({
        value: String(vocation.id),
        label: vocation.name,
      })),
    },
    {
      key: "group",
      label: "Grupo",
      type: "select",
      options: SPELL_GROUP_OPTIONS.map((group) => ({
        value: group,
        label: group,
      })),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Técnicas/Habilidades</h1>
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isFiltering={!isLoading && isValidating}
        searchPlaceholder="Buscar técnica..."
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
