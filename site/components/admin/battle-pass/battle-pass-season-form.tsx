"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  battlePassSeasonSchema,
  defaultBattlePassSeasonValues,
  type BattlePassSeasonInput,
} from "@/lib/validations/admin/battle-pass";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormattedNumberField } from "@/components/shared/formatted-number-field";
import { EntitySearchCombobox } from "@/components/shared/entity-search-combobox";
import { EntityThumb } from "@/components/shared/entity-thumb";
import { MonthYearFields } from "@/components/shared/month-year-fields";
import { BattlePassMissionListField } from "@/components/admin/battle-pass/battle-pass-mission-list-field";
import { BattlePassRewardListField } from "@/components/admin/battle-pass/battle-pass-reward-list-field";

type NamedRow = { id: number; name: string };

type BattlePassSeasonFormProps = {
  seasonId?: number;
  initialValues?: BattlePassSeasonInput;
};

export function BattlePassSeasonForm({ seasonId, initialValues }: BattlePassSeasonFormProps) {
  const router = useRouter();

  const form = useForm<BattlePassSeasonInput, unknown, BattlePassSeasonInput>({
    resolver: zodResolver(battlePassSeasonSchema),
    defaultValues: initialValues ?? defaultBattlePassSeasonValues,
  });

  async function handleSubmit(values: BattlePassSeasonInput) {
    const response = await fetch(
      seasonId ? `/api/admin/battle-pass/seasons/${seasonId}` : "/api/admin/battle-pass/seasons",
      {
        method: seasonId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      },
    );

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      toast.error(body?.error ?? "Não foi possível salvar.");
      return;
    }

    toast.success(seasonId ? "Atualizado com sucesso." : "Criado com sucesso.");

    if (!seasonId) {
      const body = await response.json().catch(() => null);
      if (body?.season?.id) {
        router.push(`/admin/battle-pass/${body.season.id}`);
        return;
      }
    }

    router.refresh();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4">
        <Tabs defaultValue="identification">
          <TabsList>
            <TabsTrigger value="identification">Identificação</TabsTrigger>
            <TabsTrigger value="missions">Missões</TabsTrigger>
            <TabsTrigger value="rewards">Recompensas</TabsTrigger>
          </TabsList>

          <TabsContent value="identification" className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <MonthYearFields control={form.control} yearName="year" monthName="month" />
              <FormattedNumberField
                control={form.control}
                name="maxLevel"
                label="Level máximo"
                tooltip="Nível mais alto que o passe pode alcançar — ao chegar nele, o jogador para de acumular XP nessa temporada."
              />
              <FormattedNumberField
                control={form.control}
                name="xpPerLevel"
                label="XP por level"
                tooltip="Quantidade de XP necessária para subir cada nível do passe."
              />
              <FormattedNumberField control={form.control} name="goldPassCost" label="Custo do passe Gold" />
            </div>

            <FormField
              control={form.control}
              name="goldPassItemId"
              render={({ field }) => {
                const itemId = field.value;
                return (
                  <FormItem>
                    <FormLabel>Item do passe Gold (cobrado do jogador)</FormLabel>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <EntitySearchCombobox<NamedRow>
                          endpoint="/api/admin/items"
                          value={itemId || null}
                          placeholder="Buscar item..."
                          formatOption={(item) => `${item.name} (#${item.id})`}
                          renderOption={(item) => (
                            <span className="flex items-center gap-2">
                              <EntityThumb entityType="item" id={item.id} name={item.name} size="32" />
                              {item.name} (#{item.id})
                            </span>
                          )}
                          onSelect={(item) => field.onChange(item?.id ?? 0)}
                        />
                      </div>
                      {itemId > 0 && <EntityThumb entityType="item" id={itemId} size="32" />}
                    </div>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormattedNumberField
                control={form.control}
                name="levelPurchaseCost"
                label="Custo para comprar 1 level"
                tooltip="Quantidade da moeda cobrada do jogador ao comprar um level avulso do passe (botão 'Lv. +' / 'Atualizar Passe')."
              />
            </div>

            <FormField
              control={form.control}
              name="levelPurchaseItemId"
              render={({ field }) => {
                const itemId = field.value;
                return (
                  <FormItem>
                    <FormLabel>Item cobrado para comprar level</FormLabel>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <EntitySearchCombobox<NamedRow>
                          endpoint="/api/admin/items"
                          value={itemId || null}
                          placeholder="Buscar item..."
                          formatOption={(item) => `${item.name} (#${item.id})`}
                          renderOption={(item) => (
                            <span className="flex items-center gap-2">
                              <EntityThumb entityType="item" id={item.id} name={item.name} size="32" />
                              {item.name} (#{item.id})
                            </span>
                          )}
                          onSelect={(item) => field.onChange(item?.id ?? 0)}
                        />
                      </div>
                      {itemId > 0 && <EntityThumb entityType="item" id={itemId} size="32" />}
                    </div>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
          </TabsContent>

          <TabsContent value="missions">
            <BattlePassMissionListField control={form.control} name="missions" />
          </TabsContent>

          <TabsContent value="rewards">
            <BattlePassRewardListField control={form.control} name="rewards" />
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
