"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import {
  dailyRewardCompetenciaSchema,
  defaultDailyRewardCompetenciaValues,
  MAX_DAILY_REWARD_BONUS_ENTRIES,
  type DailyRewardCompetenciaInput,
} from "@/lib/validations/admin/daily-reward";
import { bonusMilestones, competenciaId, daysInMonth } from "@/lib/daily-reward-competencia";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MonthYearFields } from "@/components/shared/month-year-fields";
import { DailyRewardEntryListField } from "@/components/admin/daily-rewards/daily-reward-entry-list-field";

type DailyRewardCompetenciaFormProps = {
  competenciaParam?: string;
  initialValues?: DailyRewardCompetenciaInput;
};

export function DailyRewardCompetenciaForm({
  competenciaParam,
  initialValues,
}: DailyRewardCompetenciaFormProps) {
  const router = useRouter();

  const form = useForm<DailyRewardCompetenciaInput, unknown, DailyRewardCompetenciaInput>({
    resolver: zodResolver(dailyRewardCompetenciaSchema),
    defaultValues: initialValues ?? defaultDailyRewardCompetenciaValues,
  });

  const [filling, setFilling] = useState(false);
  const month = form.watch("month");
  const year = form.watch("year");
  const maxDay = month && year ? daysInMonth(year, month) : 31;

  /** Sorteia as recompensas do mês a partir do padrão (substitui as atuais do formulário). */
  async function handleFillFromDefault() {
    setFilling(true);
    const response = await fetch("/api/admin/daily-rewards/competencias/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, year, dryRun: true }),
    });
    setFilling(false);

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      toast.error(body?.error ?? "Não foi possível gerar a partir do padrão.");
      return;
    }
    form.setValue("rewards", body.rewards, { shouldDirty: true });
    form.setValue("bonusRewards", body.bonusRewards, { shouldDirty: true });
    toast.success("Recompensas preenchidas a partir do padrão — revise e salve.");
  }

  async function handleSubmit(values: DailyRewardCompetenciaInput) {
    const response = await fetch(
      competenciaParam
        ? `/api/admin/daily-rewards/competencias/${competenciaParam}`
        : "/api/admin/daily-rewards/competencias",
      {
        method: competenciaParam ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      },
    );

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      toast.error(body?.error ?? "Não foi possível salvar.");
      return;
    }

    toast.success(competenciaParam ? "Atualizado com sucesso." : "Criado com sucesso.");

    const body = await response.json().catch(() => null);
    const newId = body?.id ?? (body ? competenciaId(body.year, body.month) : null);
    if (newId && newId !== competenciaParam) {
      router.push(`/admin/daily-rewards/${newId}`);
      return;
    }

    router.refresh();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4">
        <Tabs defaultValue="identification">
          <TabsList>
            <TabsTrigger value="identification">Identificação</TabsTrigger>
            <TabsTrigger value="rewards">Recompensas</TabsTrigger>
          </TabsList>

          <TabsContent value="identification" className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <MonthYearFields control={form.control} yearName="year" monthName="month" />
            </div>
          </TabsContent>

          <TabsContent value="rewards" className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
              <p className="text-xs text-muted-foreground">
                {maxDay} dias neste mês · marcos bonus padrão: {bonusMilestones(month).join(", ")}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleFillFromDefault}
                disabled={filling}
              >
                <Sparkles className="size-4" />
                {filling ? "Gerando..." : "Preencher com padrão"}
              </Button>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">Recompensas diárias</h3>
              <DailyRewardEntryListField
                control={form.control}
                name="rewards"
                dayField="day"
                dayLabel="Dia"
                dayMax={maxDay}
                emptyLabel="Nenhuma recompensa diária cadastrada."
                addLabel="Adicionar recompensa"
              />
            </div>

            <div className="rounded-md border border-dashed p-3">
              <h3 className="mb-2 text-sm font-semibold">Recompensas bonus</h3>
              <p className="mb-2 text-xs text-muted-foreground">
                Concedidas por sequência de dias consecutivos resgatados — limitado a{" "}
                {MAX_DAILY_REWARD_BONUS_ENTRIES} cadastros.
              </p>
              <DailyRewardEntryListField
                control={form.control}
                name="bonusRewards"
                dayField="streakDay"
                dayLabel="Sequência de"
                dayMax={maxDay}
                emptyLabel="Nenhuma recompensa bonus cadastrada."
                addLabel="Adicionar recompensa bonus"
                maxEntries={MAX_DAILY_REWARD_BONUS_ENTRIES}
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-4">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
