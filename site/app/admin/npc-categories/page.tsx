"use client";

import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import type { NpcCategory } from "@/lib/generated/prisma/client";
import type { PaginatedResult } from "@/lib/pagination";
import { defaultNpcCategoryValues, type NpcCategoryInput } from "@/lib/validations/admin/npc-category";
import { textColorFor } from "@/lib/color-utils";
import { useServerTable } from "@/hooks/use-server-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActionsMenu, DeleteRowMenuItem } from "@/components/shared/row-actions-menu";
import { NpcCategoryFormDialog } from "@/components/admin/npc-categories/npc-category-form-dialog";

export default function AdminNpcCategoriesPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating, mutate } = useSWR<PaginatedResult<NpcCategory>>(
    `/api/admin/npc-categories?${table.buildQueryParams().toString()}`,
    fetcher,
  );

  // Lista à parte (sem paginação da tabela) só pra sortear uma cor nova sem repetir nenhuma já
  // cadastrada — a página da tabela sozinha não teria todas se houver mais de uma página.
  const { data: allCategoriesData } = useSWR<PaginatedResult<NpcCategory>>(
    "/api/admin/npc-categories?pageSize=200",
    fetcher,
  );
  const existingColors = allCategoriesData?.data.map((c) => c.color) ?? [];

  async function handleDelete(id: number) {
    const response = await fetch(`/api/admin/npc-categories/${id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Não foi possível remover.");
      return;
    }
    toast.success("Removida.");
    mutate();
  }

  async function createOrUpdate(values: NpcCategoryInput, id?: number): Promise<boolean | "conflict"> {
    const response = await fetch(id ? `/api/admin/npc-categories/${id}` : "/api/admin/npc-categories", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (response.ok) {
      mutate();
      return true;
    }
    if (response.status === 409) return "conflict";
    return false;
  }

  const columns: ColumnDef<NpcCategory>[] = [
    {
      accessorKey: "name",
      header: "Categoria",
      cell: ({ row }) => (
        <Badge
          style={{
            backgroundColor: row.original.color,
            color: textColorFor(row.original.color),
            borderColor: row.original.color,
          }}
        >
          {row.original.name}
        </Badge>
      ),
    },
    {
      accessorKey: "description",
      header: "Descrição",
      cell: ({ row }) => row.original.description || "—",
    },
    {
      accessorKey: "color",
      header: "Cor",
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.color}</span>,
    },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => (
        <RowActionsMenu>
          <NpcCategoryFormDialog
            title="Editar categoria"
            defaultValues={{
              name: row.original.name,
              description: row.original.description ?? "",
              color: row.original.color,
            }}
            successMessage="Atualizada com sucesso."
            onSubmit={(values) => createOrUpdate(values, row.original.id)}
            trigger={
              <DropdownMenuItem>
                <Pencil className="size-4" />
                Editar
              </DropdownMenuItem>
            }
          />
          <DeleteRowMenuItem
            title="Remover categoria"
            description="NPCs vinculados ficam sem categoria — nenhum NPC é apagado."
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
          <h1 className="text-2xl font-semibold">Categorias de NPC</h1>
          <p className="text-muted-foreground">
            Organiza os NPCs por categoria (nome, descrição e cor) — usado no select do formulário e
            na coluna de categoria da listagem de NPCs.
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isFiltering={!isLoading && isValidating}
        searchPlaceholder="Buscar categoria..."
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
          <NpcCategoryFormDialog
            title="Nova categoria"
            defaultValues={defaultNpcCategoryValues}
            randomizeColorOnOpen
            existingColors={existingColors}
            successMessage="Criada com sucesso."
            onSubmit={(values) => createOrUpdate(values)}
            trigger={
              <Button>
                <Plus className="size-4" />
                Nova categoria
              </Button>
            }
          />
        }
      />
    </div>
  );
}
