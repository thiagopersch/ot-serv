"use client";

import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import type { Category } from "@/lib/generated/prisma/client";
import type { PaginatedResult } from "@/lib/pagination";
import { defaultCategoryValues, type CategoryInput } from "@/lib/validations/admin/category";
import { useServerTable } from "@/hooks/use-server-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActionsMenu, DeleteRowMenuItem } from "@/components/shared/row-actions-menu";
import { CategoryFormDialog } from "@/components/admin/categories/category-form-dialog";

export default function AdminCategoriesPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating, mutate } = useSWR<PaginatedResult<Category>>(
    `/api/admin/categories?${table.buildQueryParams().toString()}`,
    fetcher
  );

  async function handleDelete(id: number) {
    const response = await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Não foi possível remover.");
      return;
    }
    toast.success("Removida.");
    mutate();
  }

  async function createOrUpdate(values: CategoryInput, id?: number): Promise<boolean | "conflict"> {
    const response = await fetch(id ? `/api/admin/categories/${id}` : "/api/admin/categories", {
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

  const columns: ColumnDef<Category>[] = [
    {
      accessorKey: "name",
      header: "Categoria",
      cell: ({ row }) => (
        <Badge style={{ backgroundColor: row.original.color, color: "#fff", borderColor: row.original.color }}>
          {row.original.name}
        </Badge>
      ),
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
          <CategoryFormDialog
            title="Editar categoria"
            defaultValues={{ name: row.original.name, color: row.original.color }}
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
            description="Quests e tasks vinculadas ficam sem categoria (o texto salvo não muda retroativamente)."
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
          <h1 className="text-2xl font-semibold">Categorias</h1>
          <p className="text-muted-foreground">
            Categorias compartilhadas por Quests e Tasks — nome e cor usados nos selects e badges das duas
            listagens.
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
          <CategoryFormDialog
            title="Nova categoria"
            defaultValues={defaultCategoryValues}
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
