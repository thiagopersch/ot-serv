"use client";

import Link from "next/link";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import { useServerTable } from "@/hooks/use-server-table";
import {
  SPELL_GROUP_OPTIONS,
  SPELL_KINDS,
} from "@/lib/validations/admin/spell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActionsMenu, DeleteRowMenuItem } from "@/components/shared/row-actions-menu";
import { DuplicateButton } from "@/components/shared/duplicate-button";
import { XmlImportDialog } from "@/components/shared/xml-import-dialog";
import { CopyXmlButton } from "@/components/shared/copy-xml-button";
import { EntityThumb } from "@/components/shared/entity-thumb";
import { useEntityImages } from "@/components/shared/use-entity-images";
import { PublishedToggle } from "@/components/shared/published-toggle";
import type { FilterFieldConfig } from "@/components/shared/advanced-filter-panel";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type VocationOption = { id: number; name: string };

type SpellRow = {
  id: number;
  kind: string;
  name: string;
  words: string;
  runeItemId: number | null;
  level: number;
  mana: number;
  published: boolean;
  _count: { vocations: number };
  vocations: { vocation: { name: string } }[];
};

const KIND_BADGE_VARIANT: Record<string, "default" | "secondary" | "outline"> =
  {
    instant: "default",
    rune: "secondary",
    conjure: "outline",
  };

// eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not a page route
const exportXmlLink = <a href="/api/admin/spells/export" />;

export default function AdminSpellsPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating, mutate } = useSWR<
    PaginatedResult<SpellRow>
  >(`/api/admin/spells?${table.buildQueryParams().toString()}`, fetcher);

  const { data: levelsData } = useSWR<{ levels: number[] }>(
    "/api/admin/spells/levels",
    fetcher,
  );
  const { data: vocationsData } = useSWR<PaginatedResult<VocationOption>>(
    "/api/admin/vocations?pageSize=200",
    fetcher,
  );

  const filterFields: FilterFieldConfig[] = [
    {
      key: "kind",
      label: "Tipo",
      type: "select",
      options: SPELL_KINDS.map((kind) => ({ value: kind, label: kind })),
    },
    {
      key: "level",
      label: "Level",
      type: "select",
      options: (levelsData?.levels ?? []).map((level) => ({
        value: String(level),
        label: String(level),
      })),
    },
    {
      key: "group",
      label: "Grupo",
      type: "multi-select",
      options: SPELL_GROUP_OPTIONS.map((group) => ({
        value: group,
        label: group,
      })),
    },
    {
      key: "vocationIds",
      label: "Vocações",
      type: "multi-select",
      options: (vocationsData?.data ?? []).map((vocation) => ({
        value: String(vocation.id),
        label: `#${vocation.id} — ${vocation.name}`,
      })),
    },
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

  const images = useEntityImages(
    "spell",
    (data?.data ?? []).map((s) => s.id),
  );

  async function handleDelete(id: number) {
    const response = await fetch(`/api/admin/spells/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      toast.error("Não foi possível remover a spell.");
      return;
    }

    toast.success("Spell removida.");
    mutate();
  }

  const columns: ColumnDef<SpellRow>[] = [
    { accessorKey: "id", header: "ID" },
    {
      id: "image",
      header: "Imagem",
      cell: ({ row }) => (
        <EntityThumb
          entityType="spell"
          id={row.original.id}
          name={row.original.name}
          image={images.get(row.original.id) ?? null}
        />
      ),
    },
    {
      accessorKey: "kind",
      header: "Tipo",
      cell: ({ row }) => (
        <Badge variant={KIND_BADGE_VARIANT[row.original.kind] ?? "secondary"}>
          {row.original.kind}
        </Badge>
      ),
    },
    { accessorKey: "name", header: "Nome" },
    {
      id: "identifier",
      header: "Words / Rune id",
      cell: ({ row }) => row.original.words || row.original.runeItemId || "—",
    },
    { accessorKey: "level", header: "Level" },
    { accessorKey: "mana", header: "Mana" },
    {
      accessorKey: "published",
      header: "Publicado",
      cell: ({ row }) => (
        <PublishedToggle
          endpoint={`/api/admin/spells/${row.original.id}/publish`}
          published={row.original.published}
          onToggled={() => mutate()}
        />
      ),
    },
    {
      id: "vocations",
      header: "Vocações",
      cell: ({ row }) => {
        const count = row.original._count.vocations;
        if (count === 0) return count;

        const names = row.original.vocations.map(
          (entry) => entry.vocation.name,
        );

        return (
          <Tooltip>
            <TooltipTrigger className="cursor-default underline decoration-dotted underline-offset-2">
              {count}
            </TooltipTrigger>
            <TooltipContent>{names.join(", ")}</TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => (
        <RowActionsMenu>
          <DropdownMenuItem render={<Link href={`/admin/spells/${row.original.id}`} />}>
            <Pencil className="size-4" />
            Editar
          </DropdownMenuItem>
          <DuplicateButton
            endpoint={`/api/admin/spells/${row.original.id}/duplicate`}
            editPathBase="/admin/spells"
            onDuplicated={() => mutate()}
            variant="menuitem"
          />
          <DeleteRowMenuItem
            title="Remover spell"
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
          <h1 className="text-2xl font-semibold">Spells</h1>
          <p className="text-muted-foreground">
            CRUD de feitiços exportável para o <code>spells.xml</code>{" "}
            (instant/rune/conjure).
          </p>
        </div>

        <DataTable
          columns={columns}
          data={data?.data ?? []}
          isLoading={isLoading}
          isFiltering={!isLoading && isValidating}
          searchPlaceholder="Buscar por nome..."
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
                endpoint="/api/admin/spells/import"
                title="Importar spells.xml"
                description={
                  <>
                    Envie um arquivo no formato do <code>spells.xml</code> do
                    servidor. Spells com dados inválidos são ignoradas e
                    reportadas ao final.
                  </>
                }
                replaceLabel="Substituir todas as spells existentes antes de importar"
                itemLabel="spell(s)"
                onImported={() => mutate()}
              />
              <CopyXmlButton
                getText={async () => {
                  const response = await fetch("/api/admin/spells/export");
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
              <Button
                nativeButton={false}
                render={<Link href="/admin/spells/new" />}
              >
                <Plus className="size-4" />
                Nova spell
              </Button>
            </>
          }
        />
      </div>
    </TooltipProvider>
  );
}
