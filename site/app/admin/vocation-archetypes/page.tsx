"use client";

import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import type { VocationArchetype } from "@/lib/generated/prisma/client";
import type { PaginatedResult } from "@/lib/pagination";
import { vocationTypeSchema, type VocationTypeInput } from "@/lib/validations/admin/vocation";
import { useServerTable } from "@/hooks/use-server-table";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActionsMenu, DeleteRowMenuItem } from "@/components/shared/row-actions-menu";
import { DuplicateButton } from "@/components/shared/duplicate-button";
import { SimpleFormDialog, type SimpleField } from "@/components/shared/simple-form-dialog";

const fields: SimpleField<VocationTypeInput>[] = [{ name: "name", label: "Nome (ex.: DPS, Bruiser, Support, Tank)" }];

export default function AdminVocationArchetypesPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating, mutate } = useSWR<PaginatedResult<VocationArchetype>>(
    `/api/admin/vocation-archetypes?${table.buildQueryParams().toString()}`,
    fetcher
  );

  async function handleDelete(id: number) {
    const response = await fetch(`/api/admin/vocation-archetypes/${id}`, { method: "DELETE" });

    if (!response.ok) {
      toast.error("Não foi possível remover. Verifique se nenhuma vocação a utiliza.");
      return;
    }

    toast.success("Removido.");
    mutate();
  }

  async function createOrUpdate(values: VocationTypeInput, id?: number) {
    const response = await fetch(id ? `/api/admin/vocation-archetypes/${id}` : "/api/admin/vocation-archetypes", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (response.ok) mutate();
    return response.ok;
  }

  const columns: ColumnDef<VocationArchetype>[] = [
    { accessorKey: "id", header: "ID" },
    { accessorKey: "name", header: "Nome" },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => (
        <RowActionsMenu>
          <SimpleFormDialog
            title="Editar arquétipo"
            schema={vocationTypeSchema}
            fields={fields}
            defaultValues={{ name: row.original.name }}
            successMessage="Atualizado com sucesso."
            onSubmit={(values) => createOrUpdate(values, row.original.id)}
            trigger={
              <DropdownMenuItem>
                <Pencil className="size-4" />
                Editar
              </DropdownMenuItem>
            }
          />
          <DuplicateButton
            endpoint={`/api/admin/vocation-archetypes/${row.original.id}/duplicate`}
            editPathBase="/admin/vocation-archetypes"
            onDuplicated={() => mutate()}
            variant="menuitem"
          />
          <DeleteRowMenuItem
            title="Remover arquétipo"
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
          <h1 className="text-2xl font-semibold">Arquétipos de vocação</h1>
          <p className="text-muted-foreground">
            Opções de <code>archetype</code> disponíveis no formulário de vocação — usadas pela fórmula de dano das
            spells, defesa e buffs de regen no servidor.
          </p>
        </div>
        <SimpleFormDialog
          title="Novo arquétipo"
          schema={vocationTypeSchema}
          fields={fields}
          defaultValues={{ name: "" }}
          successMessage="Criado com sucesso."
          onSubmit={(values) => createOrUpdate(values)}
          trigger={
            <Button>
              <Plus className="size-4" />
              Novo arquétipo
            </Button>
          }
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isFiltering={!isLoading && isValidating}
        searchPlaceholder="Buscar arquétipo..."
        searchValue={table.searchInput}
        onSearchChange={table.handleSearchChange}
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
