"use client";

import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import dayjs from "dayjs";

import { fetcher } from "@/lib/fetcher";
import type { MonsterBoost } from "@/lib/generated/prisma/client";
import type { PaginatedResult } from "@/lib/pagination";
import type { MonsterBoostInput } from "@/lib/validations/admin/monster-boost";
import { useServerTable } from "@/hooks/use-server-table";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActionsMenu, DeleteRowMenuItem } from "@/components/shared/row-actions-menu";
import { LooktypeThumbById } from "@/components/shared/looktype-thumb-by-id";
import { MonsterBoostFormDialog } from "@/components/admin/monster-boost/monster-boost-form-dialog";

type MonsterOption = { id: number; name: string; lookTypeId: number | null };

export default function AdminMonsterBoostPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating, mutate } = useSWR<
    PaginatedResult<MonsterBoost>
  >(`/api/admin/monster-boost?${table.buildQueryParams().toString()}`, fetcher);

  // Resolve os nomes de monstro da página atual contra o catálogo real (para a thumbnail —
  // `monster` é salvo como string livre, sem FK, ver lib/validations/admin/monster-boost.ts).
  const { data: monstersData } = useSWR<{ data: MonsterOption[] }>(
    "/api/admin/monsters?all=true",
    fetcher,
  );
  const monsterByName = new Map(
    (monstersData?.data ?? []).map((m) => [m.name, m]),
  );

  async function handleDelete(id: number) {
    const response = await fetch(`/api/admin/monster-boost/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      toast.error("Não foi possível remover.");
      return;
    }

    toast.success("Monstro impulsionado removido.");
    mutate();
  }

  async function createOrUpdate(values: MonsterBoostInput, id?: number) {
    const response = await fetch(
      id ? `/api/admin/monster-boost/${id}` : "/api/admin/monster-boost",
      {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      },
    );

    if (response.ok) mutate();
    return response.ok;
  }

  const columns: ColumnDef<MonsterBoost>[] = [
    {
      id: "image",
      header: "Imagem",
      cell: ({ row }) => {
        const monster = monsterByName.get(row.original.monster);
        if (!monster?.lookTypeId) return "—";
        return <LooktypeThumbById looktypeId={monster.lookTypeId} />;
      },
    },
    { accessorKey: "monster", header: "Monstro (Monster)" },
    { accessorKey: "loot", header: "Loot" },
    { accessorKey: "exp", header: "Experiência (Exp)" },
    {
      accessorKey: "date",
      header: "Atualizado em",
      cell: ({ row }) => dayjs(row.original.date).format("DD/MM/YYYY HH:mm"),
    },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => (
        <RowActionsMenu>
          <MonsterBoostFormDialog
            title="Editar monstro impulsionado"
            defaultValues={{
              monster: row.original.monster,
              loot: row.original.loot,
              exp: row.original.exp,
            }}
            initialMonsterId={monsterByName.get(row.original.monster)?.id ?? null}
            initialMonsterLookTypeId={monsterByName.get(row.original.monster)?.lookTypeId ?? null}
            successMessage="Atualizado com sucesso."
            onSubmit={(values) => createOrUpdate(values, row.original.id)}
            trigger={
              <DropdownMenuItem>
                <Pencil className="size-4" />
                Editar
              </DropdownMenuItem>
            }
          />
          <DeleteRowMenuItem
            title="Remover"
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
          <h1 className="text-2xl font-semibold">Monstros impulsionados</h1>
          <p className="text-muted-foreground">
            Configure a tabela `monster_boost`.
          </p>
        </div>
        <MonsterBoostFormDialog
          title="Novo monstro impulsionado"
          defaultValues={{ monster: "", loot: 0, exp: 0 }}
          successMessage="Criado com sucesso."
          onSubmit={(values) => createOrUpdate(values)}
          trigger={
            <Button>
              <Plus className="size-4" />
              Novo
            </Button>
          }
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isFiltering={!isLoading && isValidating}
        searchPlaceholder="Buscar monstro..."
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
