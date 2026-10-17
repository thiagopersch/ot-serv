"use client";

import Link from "next/link";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import { vocationToXml, type VocationXmlData } from "@/lib/vocation-xml";
import { VOCATION_RANK_LABELS, VOCATION_RANK_COLORS, type VocationRank } from "@/lib/vocation-rank";
import type { PaginatedResult } from "@/lib/pagination";
import { useServerTable } from "@/hooks/use-server-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActionsMenu, DeleteRowMenuItem } from "@/components/shared/row-actions-menu";
import { DuplicateButton } from "@/components/shared/duplicate-button";
import { CopyXmlButton } from "@/components/shared/copy-xml-button";
import { XmlImportDialog } from "@/components/shared/xml-import-dialog";
import { EntityThumb } from "@/components/shared/entity-thumb";
import { useEntityImages } from "@/components/shared/use-entity-images";
import { PublishedToggle } from "@/components/shared/published-toggle";
import { VocationLooktypeQuickLink } from "@/components/admin/vocations/vocation-looktype-quick-link";
import { UniverseBadge } from "@/components/shared/universe-badge";
import type { FilterFieldConfig } from "@/components/shared/advanced-filter-panel";

type VocationRow = VocationXmlData;
type ArchetypeOption = { id: number; name: string };
type UniverseOption = { id: number; name: string };

// eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not a page route
const exportXmlLink = <a href="/api/admin/vocations/export" />;

export default function AdminVocationsPage() {
  const table = useServerTable();

  const { data: archetypesData } = useSWR<PaginatedResult<ArchetypeOption>>(
    "/api/admin/vocation-archetypes?pageSize=100",
    fetcher,
  );
  const { data: universesData } = useSWR<PaginatedResult<UniverseOption>>(
    "/api/admin/universes?pageSize=100",
    fetcher,
  );

  const { data, isLoading, isValidating, mutate } = useSWR<
    PaginatedResult<VocationRow>
  >(`/api/admin/vocations?${table.buildQueryParams().toString()}`, fetcher);

  const images = useEntityImages(
    "vocation",
    (data?.data ?? []).map((v) => v.id),
  );

  async function handleDelete(id: number) {
    const response = await fetch(`/api/admin/vocations/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      toast.error("Não foi possível remover a vocação.");
      return;
    }

    toast.success("Vocação removida.");
    mutate();
  }

  const filterFields: FilterFieldConfig[] = [
    {
      key: "archetypeId",
      label: "Arquétipo",
      type: "select",
      options: (archetypesData?.data ?? []).map((a) => ({
        value: String(a.id),
        label: a.name,
      })),
    },
    {
      key: "typeUniverseId",
      label: "Universo",
      type: "select",
      options: (universesData?.data ?? []).map((u) => ({
        value: String(u.id),
        label: u.name,
      })),
    },
    {
      key: "needpremium",
      label: "Premium",
      type: "select",
      options: [
        { value: "true", label: "Sim" },
        { value: "false", label: "Não" },
      ],
    },
    {
      key: "published",
      label: "Publicada (criação de personagem)",
      type: "select",
      options: [
        { value: "true", label: "Sim" },
        { value: "false", label: "Não" },
      ],
    },
    {
      key: "publishedGameplay",
      label: "Publicada (gameplay)",
      type: "select",
      options: [
        { value: "true", label: "Sim" },
        { value: "false", label: "Não" },
      ],
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

  const columns: ColumnDef<VocationRow>[] = [
    { accessorKey: "id", header: "ID" },
    {
      id: "image",
      header: "Imagem",
      cell: ({ row }) => (
        <EntityThumb
          entityType="vocation"
          id={row.original.id}
          name={row.original.name}
          image={images.get(row.original.id) ?? null}
          size="md"
        />
      ),
    },
    { accessorKey: "name", header: "Nome" },
    {
      id: "lookType",
      header: "Sprite",
      cell: ({ row }) => (
        <VocationLooktypeQuickLink
          vocationId={row.original.id}
          lookTypeId={row.original.lookTypeId}
          onLinked={() => mutate()}
        />
      ),
    },
    { accessorKey: "description", header: "Descrição" },
    {
      accessorKey: "archetypeName",
      header: "Arquétipo",
      cell: ({ row }) => row.original.archetypeName || "—",
    },
    {
      accessorKey: "typeUniverseName",
      header: "Universo",
      cell: ({ row }) =>
        row.original.typeUniverseName ? (
          <UniverseBadge name={row.original.typeUniverseName} color={row.original.typeUniverseColor} />
        ) : (
          "—"
        ),
    },
    {
      accessorKey: "maxRank",
      header: "Rank",
      cell: ({ row }) => {
        const rank = row.original.maxRank as VocationRank;
        const color = VOCATION_RANK_COLORS[rank];
        return (
          <Badge style={{ backgroundColor: color, color: "#000", borderColor: color }}>
            {VOCATION_RANK_LABELS[rank]}
          </Badge>
        );
      },
    },
    {
      accessorKey: "needpremium",
      header: "Premium",
      cell: ({ row }) => (
        <Badge variant={row.original.needpremium ? "default" : "secondary"}>
          {row.original.needpremium ? "Sim" : "Não"}
        </Badge>
      ),
    },
    {
      accessorKey: "published",
      header: "Publicada (criação)",
      cell: ({ row }) => (
        <PublishedToggle
          endpoint={`/api/admin/vocations/${row.original.id}/publish`}
          published={row.original.published}
          onToggled={() => mutate()}
        />
      ),
    },
    {
      accessorKey: "publishedGameplay",
      header: "Publicada (gameplay)",
      cell: ({ row }) => (
        <PublishedToggle
          endpoint={`/api/admin/vocations/${row.original.id}/publish-gameplay`}
          published={row.original.publishedGameplay}
          onToggled={() => mutate()}
        />
      ),
    },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => (
        <RowActionsMenu>
          <DropdownMenuItem render={<Link href={`/admin/vocations/${row.original.id}`} />}>
            <Pencil className="size-4" />
            Editar
          </DropdownMenuItem>
          <DuplicateButton
            endpoint={`/api/admin/vocations/${row.original.id}/duplicate`}
            editPathBase="/admin/vocations"
            onDuplicated={() => mutate()}
            variant="menuitem"
          />
          <CopyXmlButton
            variant="menuitem"
            label="Copiar XML desta vocação"
            getText={() => vocationToXml(row.original)}
          />
          <DeleteRowMenuItem
            title="Remover vocação"
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
      <div>
        <h1 className="text-2xl font-semibold">Vocações</h1>
        <p className="text-muted-foreground">
          CRUD de vocações exportável para o <code>vocations.xml</code> do
          servidor.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isFiltering={!isLoading && isValidating}
        searchPlaceholder="Buscar por nome ou descrição..."
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
              endpoint="/api/admin/vocations/import"
              title="Importar vocations.xml"
              description={
                <>
                  Envie um arquivo no formato do <code>vocations.xml</code> do
                  OTServer. Os arquétipos (<code>archetype</code>) e universos (
                  <code>type_universe</code>) são resolvidos pelo nome, criando
                  novos registros automaticamente quando necessário. Vocações
                  com dados inválidos são ignoradas e reportadas ao final.
                </>
              }
              replaceLabel="Substituir todas as vocações existentes antes de importar"
              itemLabel="vocação(ões)"
              onImported={() => mutate()}
            />
            <Button
              variant="outline"
              nativeButton={false}
              render={exportXmlLink}
            >
              <Download className="size-4" />
              Exportar XML
            </Button>
            <CopyXmlButton
              label="Copiar XML (todas)"
              getText={async () => {
                const response = await fetch("/api/admin/vocations/export");
                return response.text();
              }}
            />
            <Button
              nativeButton={false}
              render={<Link href="/admin/vocations/new" />}
            >
              <Plus className="size-4" />
              Nova vocação
            </Button>
          </>
        }
      />
    </div>
  );
}
