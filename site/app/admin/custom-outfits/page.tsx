"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import type { CustomOutfit } from "@/lib/generated/prisma/client";
import {
  CUSTOM_OUTFIT_STORAGE_BASE,
  defaultCustomOutfitValues,
  type CustomOutfitInput,
} from "@/lib/validations/admin/custom-outfit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  RowActionsMenu,
  DeleteRowMenuItem,
} from "@/components/shared/row-actions-menu";
import { EntityThumb } from "@/components/shared/entity-thumb";
import { OutfitThumbByNumber } from "@/components/shared/outfit-thumb-by-number";
import type { FilterFieldConfig, FilterValues } from "@/components/shared/advanced-filter-panel";
import { CustomOutfitFormDialog } from "@/components/admin/custom-outfits/custom-outfit-form-dialog";

const RELOAD_HINT =
  "Aplique no jogo com /reload outfits e /reload actions (ou reinicie o servidor).";

export default function AdminCustomOutfitsPage() {
  const { data, isLoading, mutate } = useSWR<{ outfits: CustomOutfit[] }>(
    "/api/admin/custom-outfits",
    fetcher,
  );
  const [search, setSearch] = useState("");
  const [draftFilters, setDraftFilters] = useState<FilterValues>({});
  const [appliedFilters, setAppliedFilters] = useState<FilterValues>({});

  // A API devolve a lista inteira — busca e filtros são aplicados aqui.
  const outfits = useMemo(() => {
    const term = search.trim().toLowerCase();
    const status = appliedFilters.active;
    return (data?.outfits ?? []).filter((outfit) => {
      if (status === "true" && !outfit.active) return false;
      if (status === "false" && outfit.active) return false;
      if (!term) return true;
      return (
        outfit.name.toLowerCase().includes(term) ||
        String(outfit.lookType) === term ||
        String(outfit.itemId) === term
      );
    });
  }, [data, search, appliedFilters]);

  const filterFields: FilterFieldConfig[] = [
    {
      key: "active",
      label: "Status",
      type: "select",
      options: [
        { value: "true", label: "Ativo" },
        { value: "false", label: "Inativo" },
      ],
    },
  ];

  /** Mostra o aviso de sincronização dos arquivos do servidor (outfits.xml/actions.xml). */
  function notifySync(syncError: string | null | undefined) {
    if (syncError)
      toast.warning(
        `Salvo no banco, mas os arquivos do servidor falharam: ${syncError}`,
      );
    else toast.info(RELOAD_HINT);
  }

  async function handleDelete(id: number) {
    const response = await fetch(`/api/admin/custom-outfits/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      toast.error("Não foi possível remover.");
      return;
    }
    const body = await response.json().catch(() => null);
    toast.success("Removido.");
    notifySync(body?.syncError);
    mutate();
  }

  async function createOrUpdate(
    values: CustomOutfitInput,
    id?: number,
  ): Promise<string | null> {
    const response = await fetch(
      id ? `/api/admin/custom-outfits/${id}` : "/api/admin/custom-outfits",
      {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      },
    );
    const body = await response.json().catch(() => null);
    if (!response.ok) return body?.error ?? "Não foi possível salvar.";
    notifySync(body?.syncError);
    mutate();
    return null;
  }

  const columns: ColumnDef<CustomOutfit>[] = [
    {
      id: "outfit",
      header: "Outfit",
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <OutfitThumbByNumber looktypeNumber={row.original.lookType} size="sm" />
          <span className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            <span className="text-xs text-muted-foreground">
              Looktype {row.original.lookType}
            </span>
          </span>
        </span>
      ),
    },
    {
      id: "item",
      header: "Item que libera",
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <EntityThumb entityType="item" id={row.original.itemId} size="32" />#
          {row.original.itemId}
        </span>
      ),
    },
    {
      id: "storage",
      header: "Storage",
      cell: ({ row }) => CUSTOM_OUTFIT_STORAGE_BASE + row.original.id,
    },
    {
      id: "active",
      header: "Status",
      cell: ({ row }) =>
        row.original.active ? (
          <Badge>Ativo</Badge>
        ) : (
          <Badge variant="outline">Inativo</Badge>
        ),
    },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => (
        <RowActionsMenu>
          <CustomOutfitFormDialog
            title="Editar outfit"
            defaultValues={{
              name: row.original.name,
              lookType: row.original.lookType,
              itemId: row.original.itemId,
              clientId: row.original.clientId,
              active: row.original.active,
            }}
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
            title="Remover outfit"
            description="O outfit deixa de existir no jogo (quem já liberou perde acesso). Esta ação não pode ser desfeita."
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
        <h1 className="text-2xl font-semibold">Outfits customizados</h1>
        <p className="text-muted-foreground">
          Outfits liberados para qualquer vocação ao usar o item configurado.
          A liberação fica salva no personagem para sempre e ele troca pela
          janela de outfit. {RELOAD_HINT}
        </p>
      </div>

      <DataTable
        columns={columns}
        data={outfits}
        isLoading={isLoading}
        searchPlaceholder="Buscar por nome, looktype ou item..."
        searchValue={search}
        onSearchChange={setSearch}
        filters={filterFields}
        filterValues={draftFilters}
        onFilterValuesChange={setDraftFilters}
        onApplyFilters={() => setAppliedFilters(draftFilters)}
        onClearFilters={() => {
          setDraftFilters({});
          setAppliedFilters({});
        }}
        toolbar={
          <CustomOutfitFormDialog
            title="Novo outfit"
            defaultValues={defaultCustomOutfitValues}
            successMessage="Criado com sucesso."
            onSubmit={(values) => createOrUpdate(values)}
            trigger={
              <Button>
                <Plus className="size-4" />
                Novo outfit
              </Button>
            }
          />
        }
      />
    </div>
  );
}
