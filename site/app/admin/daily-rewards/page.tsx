"use client";

import Link from "next/link";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import { Plus, Pencil, Settings2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import { competenciaId } from "@/lib/daily-reward-competencia";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActionsMenu, DeleteRowMenuItem } from "@/components/shared/row-actions-menu";
import { DuplicateButton } from "@/components/shared/duplicate-button";
import { EntityThumb } from "@/components/shared/entity-thumb";

type CompetenciaRow = {
  year: number;
  month: number;
  rewardCount: number;
  bonusCount: number;
  previewItemIds: number[];
};

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export default function AdminDailyRewardsPage() {
  const { data, isLoading, mutate } = useSWR<{ competencias: CompetenciaRow[] }>(
    "/api/admin/daily-rewards/competencias",
    fetcher,
  );

  const competencias = data?.competencias ?? [];
  const [generating, setGenerating] = useState(false);

  /** Gera o próximo mês sem competência a partir do padrão (o servidor também faz isso sozinho
   * na virada do mês — aqui é para conferir/ajustar antes). */
  async function handleGenerateNext() {
    const taken = new Set(competencias.map((c) => competenciaId(c.year, c.month)));
    const date = new Date();
    let month = date.getMonth() + 1;
    let year = date.getFullYear();
    while (taken.has(competenciaId(year, month))) {
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }

    setGenerating(true);
    const response = await fetch("/api/admin/daily-rewards/competencias/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, year }),
    });
    setGenerating(false);

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      toast.error(body?.error ?? "Não foi possível gerar.");
      return;
    }
    toast.success(`${MONTH_NAMES[month - 1]}/${year} gerado a partir do padrão.`);
    mutate();
  }

  async function handleDelete(id: string) {
    const response = await fetch(`/api/admin/daily-rewards/competencias/${id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Não foi possível remover.");
      return;
    }
    toast.success("Competência removida.");
    mutate();
  }

  const columns: ColumnDef<CompetenciaRow>[] = [
    {
      id: "monthYear",
      header: "Mês/Ano",
      cell: ({ row }) => `${MONTH_NAMES[row.original.month - 1]}/${row.original.year}`,
    },
    {
      id: "rewardCount",
      header: "Qtd. recompensas",
      cell: ({ row }) => row.original.rewardCount,
    },
    {
      id: "bonusCount",
      header: "Qtd. bonus",
      cell: ({ row }) => <Badge variant="outline">{row.original.bonusCount}</Badge>,
    },
    {
      id: "preview",
      header: "Itens",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {row.original.previewItemIds.map((itemId, index) => (
            <EntityThumb key={`${itemId}-${index}`} entityType="item" id={itemId} size="32" />
          ))}
        </div>
      ),
    },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => {
        const id = competenciaId(row.original.year, row.original.month);
        return (
          <RowActionsMenu>
            <DropdownMenuItem render={<Link href={`/admin/daily-rewards/${id}`} />}>
              <Pencil className="size-4" />
              Editar
            </DropdownMenuItem>
            <DuplicateButton
              endpoint={`/api/admin/daily-rewards/competencias/${id}/duplicate`}
              editPathBase="/admin/daily-rewards"
              variant="menuitem"
              onDuplicated={() => mutate()}
            />
            <DeleteRowMenuItem
              title="Remover"
              description="Esta ação não pode ser desfeita. Todas as recompensas diárias e bonus dessa competência serão removidas."
              confirmLabel="Remover"
              onConfirm={() => handleDelete(id)}
            />
          </RowActionsMenu>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Recompensas diárias</h1>
          <p className="text-muted-foreground">
            Competências de recompensas diárias e bonus (tabelas `daily_rewards_monthly` e
            `daily_rewards_bonus_monthly`), agrupadas por mês/ano. Meses sem competência são gerados
            pelo servidor a partir do padrão na virada do mês.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/admin/daily-rewards/default" />}
          >
            <Settings2 className="size-4" />
            Padrão do mês
          </Button>
          <Button variant="outline" onClick={handleGenerateNext} disabled={generating || isLoading}>
            <Sparkles className="size-4" />
            {generating ? "Gerando..." : "Gerar próximo mês"}
          </Button>
          <Button nativeButton={false} render={<Link href="/admin/daily-rewards/new" />}>
            <Plus className="size-4" />
            Nova competência
          </Button>
        </div>
      </div>

      <DataTable columns={columns} data={competencias} isLoading={isLoading} />
    </div>
  );
}
