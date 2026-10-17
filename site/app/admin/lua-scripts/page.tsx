"use client";

import Link from "next/link";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, FolderTree, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import { isSiteAdmin } from "@/lib/auth-constants";
import type { LuaScript } from "@/lib/generated/prisma/client";
import type { PaginatedResult } from "@/lib/pagination";
import { LUA_SCRIPT_CATEGORIES } from "@/lib/validations/admin/lua-script";
import { useServerTable } from "@/hooks/use-server-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActionsMenu, DeleteRowMenuItem } from "@/components/shared/row-actions-menu";
import { DuplicateButton } from "@/components/shared/duplicate-button";
import { LuaScriptImportDialog } from "@/components/admin/lua-scripts/lua-script-import-dialog";
import type { FilterFieldConfig } from "@/components/shared/advanced-filter-panel";

async function downloadFile(url: string, filename: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Falha ao baixar ${filename}`);

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function AdminLuaScriptsPage() {
  const { data: session } = useSession();
  const table = useServerTable();

  const { data, isLoading, isValidating, mutate } = useSWR<
    PaginatedResult<LuaScript>
  >(`/api/admin/lua-scripts?${table.buildQueryParams().toString()}`, fetcher);

  async function handleDelete(id: number) {
    const response = await fetch(`/api/admin/lua-scripts/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      toast.error("Não foi possível remover o script.");
      return;
    }

    toast.success("Script removido.");
    mutate();
  }

  async function handleExportAll() {
    const rows = data?.data ?? [];
    if (rows.length === 0) {
      toast.error("Nenhum script para exportar.");
      return;
    }

    for (const row of rows) {
      await downloadFile(`/api/admin/lua-scripts/${row.id}/export`, row.name);
      await wait(200);
    }

    toast.success(`${rows.length} arquivo(s) baixado(s).`);
  }

  const filterFields: FilterFieldConfig[] = [
    {
      key: "category",
      label: "Categoria",
      type: "select",
      options: LUA_SCRIPT_CATEGORIES.map((category) => ({
        value: category,
        label: category,
      })),
    },
  ];

  const columns: ColumnDef<LuaScript>[] = [
    { accessorKey: "id", header: "ID" },
    { accessorKey: "name", header: "Nome (Name)" },
    {
      accessorKey: "category",
      header: "Categoria (Category)",
      cell: ({ row }) => (
        <Badge variant="secondary">{row.original.category}</Badge>
      ),
    },
    {
      id: "preview",
      header: "Prévia (Preview)",
      cell: ({ row }) => (
        <code className="text-xs text-muted-foreground">
          {row.original.content.slice(0, 60) || "—"}
          {row.original.content.length > 60 ? "..." : ""}
        </code>
      ),
    },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => (
        <RowActionsMenu>
          <DropdownMenuItem render={<Link href={`/admin/lua-scripts/${row.original.id}`} />}>
            <Pencil className="size-4" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem render={<a href={`/api/admin/lua-scripts/${row.original.id}/export`} />}>
            <Download className="size-4" />
            Exportar
          </DropdownMenuItem>
          <DuplicateButton
            endpoint={`/api/admin/lua-scripts/${row.original.id}/duplicate`}
            editPathBase="/admin/lua-scripts"
            onDuplicated={() => mutate()}
            variant="menuitem"
          />
          <DeleteRowMenuItem
            title="Remover script"
            description="Movements vinculados a este script perdem o vínculo (o campo action value digitado é mantido)."
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
        <h1 className="text-2xl font-semibold">Scripts Lua</h1>
        <p className="text-muted-foreground">
          Cadastro de scripts <code>.lua</code> reais para vincular como
          conveniência aos Movements do tipo SCRIPT — o export do{" "}
          <code>movements.xml</code> continua usando o nome do arquivo, não o
          conteúdo aqui salvo.
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
            <LuaScriptImportDialog onImported={() => mutate()} />
            <Button variant="outline" onClick={handleExportAll}>
              <Download className="size-4" />
              Exportar listados
            </Button>
            {isSiteAdmin(session?.user?.groupId) && (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/admin/lua-scripts/explorer" />}
              >
                <FolderTree className="size-4" />
                Explorador do servidor
              </Button>
            )}
            <Button
              nativeButton={false}
              render={<Link href="/admin/lua-scripts/new" />}
            >
              <Plus className="size-4" />
              Novo
            </Button>
          </>
        }
      />
    </div>
  );
}
