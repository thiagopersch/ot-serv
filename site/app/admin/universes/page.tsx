"use client";

import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import type { Universe } from "@/lib/generated/prisma/client";
import type { PaginatedResult } from "@/lib/pagination";
import { universeSchema, type UniverseInput } from "@/lib/validations/admin/universe";
import { useServerTable } from "@/hooks/use-server-table";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActionsMenu, DeleteRowMenuItem } from "@/components/shared/row-actions-menu";
import { DuplicateButton } from "@/components/shared/duplicate-button";
import { SimpleFormDialog, type SimpleField } from "@/components/shared/simple-form-dialog";
import { UniverseBadge } from "@/components/shared/universe-badge";

const fields: SimpleField<UniverseInput>[] = [
  { name: "name", label: "Nome (ex.: Dragon Ball, Naruto)" },
  { name: "color", label: "Cor", type: "color" },
];

export default function AdminUniversesPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating, mutate } = useSWR<PaginatedResult<Universe>>(
    `/api/admin/universes?${table.buildQueryParams().toString()}`,
    fetcher
  );

  async function handleDelete(id: number) {
    const response = await fetch(`/api/admin/universes/${id}`, { method: "DELETE" });

    if (!response.ok) {
      toast.error("Não foi possível remover. Verifique se nenhum registro o utiliza.");
      return;
    }

    toast.success("Removido.");
    mutate();
  }

  async function createOrUpdate(values: UniverseInput, id?: number) {
    const response = await fetch(id ? `/api/admin/universes/${id}` : "/api/admin/universes", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (response.ok) mutate();
    return response.ok;
  }

  const columns: ColumnDef<Universe>[] = [
    { accessorKey: "id", header: "ID" },
    {
      accessorKey: "name",
      header: "Nome",
      cell: ({ row }) => <UniverseBadge name={row.original.name} color={row.original.color} />,
    },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => (
        <RowActionsMenu>
          <SimpleFormDialog
            title="Editar universo"
            schema={universeSchema}
            fields={fields}
            defaultValues={{ name: row.original.name, color: row.original.color }}
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
            endpoint={`/api/admin/universes/${row.original.id}/duplicate`}
            editPathBase="/admin/universes"
            onDuplicated={() => mutate()}
            variant="menuitem"
          />
          <DeleteRowMenuItem
            title="Remover universo"
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
          <h1 className="text-2xl font-semibold">Universos</h1>
          <p className="text-muted-foreground">
            Universos genéricos (ex.: Dragon Ball, Naruto) reutilizáveis por outros CRUDs
            (Vocações, Monstros, ...). A cor é refletida em badge nas listagens.
          </p>
        </div>
        <SimpleFormDialog
          title="Novo universo"
          schema={universeSchema}
          fields={fields}
          defaultValues={{ name: "", color: null }}
          successMessage="Criado com sucesso."
          onSubmit={(values) => createOrUpdate(values)}
          trigger={
            <Button>
              <Plus className="size-4" />
              Novo universo
            </Button>
          }
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isFiltering={!isLoading && isValidating}
        searchPlaceholder="Buscar universo..."
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
