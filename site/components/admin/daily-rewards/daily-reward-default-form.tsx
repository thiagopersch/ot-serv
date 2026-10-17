"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import useSWR from "swr";
import { useForm, useWatch, type Control } from "react-hook-form";
import { toast } from "sonner";

import {
  DAILY_REWARD_RARITIES,
  DAILY_REWARD_RARITY_LABELS,
  dailyRewardDefaultSchema,
  type DailyRewardDefaultInput,
  type DailyRewardRarity,
} from "@/lib/validations/admin/daily-reward-default";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetcher } from "@/lib/fetcher";
import type { CustomOutfit } from "@/lib/generated/prisma/client";
import { Form } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NumberField } from "@/components/shared/number-field";
import { LooktypeThumbById } from "@/components/shared/looktype-thumb-by-id";
import { EntityThumb } from "@/components/shared/entity-thumb";
import { DailyRewardEntryListField } from "@/components/admin/daily-rewards/daily-reward-entry-list-field";

type DailyRewardDefaultFormProps = {
  initialValues: DailyRewardDefaultInput;
};

export function DailyRewardDefaultForm({
  initialValues,
}: DailyRewardDefaultFormProps) {
  const router = useRouter();

  const form = useForm<
    DailyRewardDefaultInput,
    unknown,
    DailyRewardDefaultInput
  >({
    resolver: zodResolver(dailyRewardDefaultSchema),
    defaultValues: initialValues,
  });

  async function handleSubmit(values: DailyRewardDefaultInput) {
    const response = await fetch("/api/admin/daily-rewards/default", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      toast.error(body?.error ?? "Não foi possível salvar.");
      return;
    }

    toast.success("Padrão atualizado.");
    router.refresh();
  }

  const dailyError = form.formState.errors.daily?.message;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex flex-col gap-4"
      >
        <Tabs defaultValue="daily">
          <TabsList>
            <TabsTrigger value="daily">Diários</TabsTrigger>
            <TabsTrigger value="bonus">Bonus</TabsTrigger>
            <TabsTrigger value="outfits">Outfits bonus</TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Para cada dia do mês o servidor sorteia uma raridade pelo peso
              (entre as raridades com itens) e depois um item dessa raridade.
            </p>
            {dailyError && (
              <p className="text-sm text-destructive">{dailyError}</p>
            )}
            {DAILY_REWARD_RARITIES.map((rarity) => (
              <div key={rarity} className="rounded-md border p-3">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">
                      {DAILY_REWARD_RARITY_LABELS[rarity]}
                    </h3>
                    <RarityChance control={form.control} rarity={rarity} />
                  </div>
                  <div className="w-32">
                    <NumberField
                      control={form.control}
                      name={`weights.${rarity}`}
                      label="Peso"
                      min={0}
                      max={1000}
                      tooltip="Peso relativo no sorteio da raridade (0 desativa)."
                    />
                  </div>
                </div>
                <DailyRewardEntryListField
                  control={form.control}
                  name={`daily.${rarity}`}
                  emptyLabel="Nenhum item nesta raridade."
                  addLabel="Adicionar item"
                />
              </div>
            ))}
          </TabsContent>

          <TabsContent value="bonus" className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Um item aleatório desta lista é escolhido para cada marco de dias
              consecutivos (5, 10, 15, 20, 25 e 30 — em fevereiro o último marco
              é o dia 28).
            </p>
            <DailyRewardEntryListField
              control={form.control}
              name="bonus"
              emptyLabel="Nenhum item bonus cadastrado."
              addLabel="Adicionar item bonus"
            />
          </TabsContent>

          <TabsContent value="outfits" className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Ao resgatar um bonus o jogador também recebe o item de um outfit
              aleatório entre os marcados — ao usar o item o outfit fica
              liberado para sempre, em qualquer vocação. Cadastre os outfits em{" "}
              <Link href="/admin/custom-outfits" className="underline">
                Outfits customizados
              </Link>
              .
            </p>
            <OutfitPickerField
              control={form.control}
              setValue={(ids) =>
                form.setValue("customOutfitIds", ids, { shouldDirty: true })
              }
            />
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

/** Chance efetiva da raridade (peso / soma dos pesos das raridades que têm itens). */
function RarityChance({
  control,
  rarity,
}: {
  control: Control<DailyRewardDefaultInput>;
  rarity: DailyRewardRarity;
}) {
  const weights = useWatch({ control, name: "weights" });
  const daily = useWatch({ control, name: "daily" });

  const effective = (r: DailyRewardRarity) =>
    (daily?.[r]?.length ?? 0) > 0 ? Number(weights?.[r]) || 0 : 0;
  const total = DAILY_REWARD_RARITIES.reduce((sum, r) => sum + effective(r), 0);
  const chance = total > 0 ? (effective(rarity) / total) * 100 : 0;

  return <Badge variant="outline">{chance.toFixed(1)}%</Badge>;
}

function OutfitPickerField({
  control,
  setValue,
}: {
  control: Control<DailyRewardDefaultInput>;
  setValue: (ids: number[]) => void;
}) {
  const { data, isLoading } = useSWR<{ outfits: CustomOutfit[] }>(
    "/api/admin/custom-outfits",
    fetcher,
  );
  const selected = useWatch({ control, name: "customOutfitIds" }) ?? [];
  const outfits = (data?.outfits ?? []).filter(
    (o) => o.active || selected.includes(o.id),
  );

  function toggle(id: number, checked: boolean) {
    setValue(
      checked ? [...selected, id] : selected.filter((value) => value !== id),
    );
  }

  if (isLoading)
    return (
      <p className="text-sm text-muted-foreground">Carregando outfits...</p>
    );
  if (outfits.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum outfit customizado cadastrado.
      </p>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {outfits.map((outfit) => (
        <label
          key={outfit.id}
          className="flex cursor-pointer items-center gap-3 rounded-md border p-2 text-sm"
        >
          <input
            type="checkbox"
            className="size-4"
            checked={selected.includes(outfit.id)}
            onChange={(event) => toggle(outfit.id, event.target.checked)}
          />
          <LooktypeThumbById looktypeId={outfit.lookType} size="sm" />
          <span className="flex flex-1 flex-col">
            <span className="font-medium">{outfit.name}</span>
            <span className="text-xs text-muted-foreground">
              Looktype {outfit.lookType}
              {!outfit.active && " · inativo"}
            </span>
          </span>
          <EntityThumb entityType="item" id={outfit.itemId} size="32" />
        </label>
      ))}
    </div>
  );
}
