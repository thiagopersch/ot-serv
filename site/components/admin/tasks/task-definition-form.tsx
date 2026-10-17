"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  taskDefinitionSchema,
  nameToTaskSlug,
  type TaskDefinitionInput,
} from "@/lib/validations/admin/task-definition";
import { TASK_DIFFICULTIES, TASK_DIFFICULTY_LABELS } from "@/lib/task-difficulty";
import { TASK_TYPES, TASK_TYPE_LABELS } from "@/lib/task-type";
import { formatLooktypeOption } from "@/lib/validations/admin/looktype";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NumberField } from "@/components/shared/number-field";
import { FormattedNumberField } from "@/components/shared/formatted-number-field";
import { formatThousands } from "@/lib/utils";
import { TASK_DIFFICULTY_COLORS } from "@/lib/task-difficulty";
import { EntitySearchCombobox } from "@/components/shared/entity-search-combobox";
import { EntityThumb } from "@/components/shared/entity-thumb";
import { FieldTooltip } from "@/components/shared/field-tooltip";
import { LooktypeAnimatedImage } from "@/components/shared/looktype-animated-image";
import { LooktypeThumbById } from "@/components/shared/looktype-thumb-by-id";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CategorySelect } from "@/components/admin/categories/category-select";
import { TaskMonsterListField } from "@/components/admin/tasks/task-monster-list-field";
import { QuestRewardItemListField } from "@/components/admin/quests/quest-reward-item-list-field";
import { useItemName } from "@/components/shared/use-item-name";

/** 1 crystal coin = 10000 gold coin — mesma conversão usada em outros CRUDs (ex.: loja de NPC). */
const GOLD_PER_CRYSTAL = 10000;

type LooktypeRow = {
  id: number;
  name: string;
  looktypeNumber: number | null;
  frameCount: number;
  frameDurationsMs: number[];
  updatedAt: string;
};

type TaskDefinitionFormProps = {
  defaultValues: TaskDefinitionInput;
  /** Já existe (edição) — trava o identificador no valor atual em vez de derivar do Nome. */
  isEditing?: boolean;
  onSubmit: (values: TaskDefinitionInput) => Promise<boolean | "conflict">;
  successMessage: string;
};

export function TaskDefinitionForm({
  defaultValues,
  isEditing = false,
  onSubmit,
  successMessage,
}: TaskDefinitionFormProps) {
  const router = useRouter();

  const form = useForm<TaskDefinitionInput, unknown, TaskDefinitionInput>({
    resolver: zodResolver(taskDefinitionSchema),
    defaultValues,
  });

  const deliveryEnabled = form.watch("deliveryEnabled");
  const name = form.watch("name");
  const lookType = form.watch("lookType");
  const watchedRewardItems = form.watch("rewardItems") ?? [];

  // O identificador é sempre travado no formulário: em criação ele acompanha o Nome (virando
  // a chave estável gravada em player_tasks.task_id); em edição, o valor existente nunca muda.
  useEffect(() => {
    if (!isEditing) form.setValue("id", nameToTaskSlug(name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, isEditing]);

  async function handleSubmit(values: TaskDefinitionInput) {
    const result = await onSubmit(values);

    if (result === "conflict") {
      form.setError("id", { type: "manual", message: "Já existe uma task com esse identificador." });
      toast.error("Já existe uma task com esse identificador.");
      return;
    }

    if (!result) {
      toast.error("Não foi possível salvar.");
      return;
    }

    toast.success(successMessage);
    router.push("/admin/tasks");
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4">
        <Tabs defaultValue="identification">
          <TabsList>
            <TabsTrigger value="identification">Identificação</TabsTrigger>
            <TabsTrigger value="monsters">Monstros</TabsTrigger>
            <TabsTrigger value="rewards">Recompensas</TabsTrigger>
          </TabsList>

          <TabsContent value="identification" className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="published"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2">
                  <FormControl>
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={field.value}
                      onChange={(event) => field.onChange(event.target.checked)}
                    />
                  </FormControl>
                  <FormLabel className="!mt-0 flex items-center gap-1.5">
                    Publicada
                    <FieldTooltip text="Só tasks publicadas ficam disponíveis para os jogadores no jogo." />
                  </FormLabel>
                </FormItem>
              )}
            />

            <div className="flex flex-col gap-2 rounded-md border border-border p-3">
              <FormField
                control={form.control}
                name="deliveryEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-2">
                    <FormControl>
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={field.value}
                        onChange={(event) => field.onChange(event.target.checked)}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0 flex items-center gap-1.5">
                      Exige entrega de item para resgatar a recompensa
                      <FieldTooltip text="Se ativado, o jogador precisa ter os itens no inventário para reivindicar a recompensa — eles são removidos automaticamente ao resgatar." />
                    </FormLabel>
                  </FormItem>
                )}
              />
              {deliveryEnabled && (
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <FormField
                      control={form.control}
                      name="deliveryItemId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Item exigido na entrega</FormLabel>
                          <EntitySearchCombobox<{ id: number; name: string }>
                            endpoint="/api/admin/items"
                            value={field.value || null}
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
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="w-28">
                    <NumberField control={form.control} name="deliveryCount" label="Quantidade" />
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-4 pt-2 sm:grid-cols-2 lg:grid-cols-3">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      Nome
                      <FieldTooltip text="Nome exibido para o jogador na lista de tasks." />
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      Identificador (slug)
                      <FieldTooltip text="Gerado automaticamente a partir do Nome. Depois de criada a task, não muda mais — trocar isso faria os jogadores perderem o progresso salvo." />
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="task_wolf_hollow" disabled {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <CategorySelect
                control={form.control}
                name="categoryId"
                tooltip="Restringe a task a uma vocação específica. Use 'General' para liberar a task para todas as vocações."
              />
              <FormField
                control={form.control}
                name="difficulty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      Dificuldade
                      <FieldTooltip text="Define quantos pontos de rank a task concede ao ser concluída — não é o mesmo valor do campo 'Pontos' abaixo, que é só informativo." />
                    </FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione a dificuldade">
                            {(value: string | null) =>
                              value ? (
                                <span className="flex items-center gap-2">
                                  <span
                                    className="size-2.5 shrink-0 rounded-full"
                                    style={{
                                      backgroundColor:
                                        TASK_DIFFICULTY_COLORS[value as (typeof TASK_DIFFICULTIES)[number]],
                                    }}
                                  />
                                  {TASK_DIFFICULTY_LABELS[value as (typeof TASK_DIFFICULTIES)[number]]}
                                </span>
                              ) : (
                                "Selecione a dificuldade"
                              )
                            }
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TASK_DIFFICULTIES.map((difficulty) => (
                          <SelectItem key={difficulty} value={difficulty}>
                            <span className="flex items-center gap-2">
                              <span
                                className="size-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: TASK_DIFFICULTY_COLORS[difficulty] }}
                              />
                              {TASK_DIFFICULTY_LABELS[difficulty]}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      Tipo
                      <FieldTooltip text="'Kill' (matar monstros) ou 'Entrega' (entregar itens). O jogador só pode ter uma task ativa de cada tipo por vez." />
                    </FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione o tipo">
                            {(value: string | null) =>
                              value ? TASK_TYPE_LABELS[value as (typeof TASK_TYPES)[number]] : "Selecione o tipo"
                            }
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TASK_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {TASK_TYPE_LABELS[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel className="flex items-center gap-1.5">
                  Looktype (ícone)
                  <FieldTooltip text="Sprite/outfit exibido para representar a task na interface do jogador." />
                </FormLabel>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <EntitySearchCombobox<LooktypeRow>
                      endpoint="/api/admin/looktypes"
                      value={lookType || null}
                      placeholder="Buscar looktype..."
                      formatOption={(lt) => formatLooktypeOption(lt)}
                      renderOption={(lt) => (
                        <span className="flex items-center gap-2">
                          <LooktypeAnimatedImage
                            key={lt.id}
                            looktypeId={lt.id}
                            frameCount={lt.frameCount}
                            frameDurationsMs={lt.frameDurationsMs}
                            updatedAt={lt.updatedAt}
                            size="sm"
                          />
                          {formatLooktypeOption(lt)}
                        </span>
                      )}
                      onSelect={(lt) => form.setValue("lookType", lt?.id ?? 0)}
                    />
                  </div>
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-md border border-border bg-muted/20">
                    {lookType > 0 ? (
                      <LooktypeThumbById looktypeId={lookType} />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              </FormItem>
              <FormattedNumberField
                control={form.control}
                name="levelRequired"
                label="Level mínimo"
                tooltip="Nível mínimo do personagem para poder iniciar a task."
              />
              <FormattedNumberField
                control={form.control}
                name="rankRequired"
                label="Rank mínimo"
                tooltip="Pontos de task acumulados exigidos para poder iniciar a task."
              />
              <FormattedNumberField
                control={form.control}
                name="killsRequired"
                label="Kills necessários"
                tooltip="Total de mortes exigidas, somando qualquer monstro da lista da aba Monstros."
              />
              <FormattedNumberField
                control={form.control}
                name="points"
                label="Pontos"
                tooltip="Só aparece na interface do jogador — os pontos realmente concedidos dependem da Dificuldade escolhida acima."
              />
            </div>

            <FormField
              control={form.control}
              name="postId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Post vinculado (opcional — vira link no nome da task)</FormLabel>
                  <EntitySearchCombobox<{ id: number; title: string }>
                    endpoint="/api/admin/posts"
                    value={field.value}
                    placeholder="Buscar post..."
                    formatOption={(post) => post.title}
                    onSelect={(post) => field.onChange(post?.id ?? null)}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>

          <TabsContent value="monsters">
            <div className="flex flex-col gap-2 rounded-md border border-border p-3">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                Monstros da task
                <FieldTooltip text="A morte de qualquer monstro da lista conta para o total de Kills necessários." />
              </span>
              <TaskMonsterListField control={form.control} name="monsters" />
            </div>
          </TabsContent>

          <TabsContent value="rewards" className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormattedNumberField
                control={form.control}
                name="experience"
                label="Recompensa: XP"
                tooltip="Experiência concedida ao reivindicar a recompensa."
              />
              <FormField
                control={form.control}
                name="money"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      Recompensa: Dinheiro (crystal coin)
                      <FieldTooltip text="Preencha em crystal coin — é convertido automaticamente para gold coin ao salvar." />
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="numeric"
                        name={field.name}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        value={formatThousands(Math.round((Number(field.value) || 0) / GOLD_PER_CRYSTAL))}
                        onChange={(event) => {
                          const digits = event.target.value.replace(/\D/g, "");
                          field.onChange(digits === "" ? 0 : Number(digits) * GOLD_PER_CRYSTAL);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-col gap-2 rounded-md border border-border p-3">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                Itens de recompensa
                <FieldTooltip text="Entregues em uma backpack ao reivindicar a task." />
              </span>
              <QuestRewardItemListField control={form.control} name="rewardItems" />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" onClick={() => router.push("/admin/tasks")}>
            Cancelar
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
      </Form>

      <div className="flex flex-col gap-6 lg:sticky lg:top-6">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Recompensas configuradas</CardTitle>
          </CardHeader>
          <CardContent>
            {watchedRewardItems.filter((item) => item?.itemId > 0).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum item de recompensa configurado ainda.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {watchedRewardItems
                  .filter((item): item is { itemId: number; count: number } => Boolean(item?.itemId > 0))
                  .map((item, index) => (
                    <TaskRewardPreviewRow key={`${item.itemId}-${index}`} itemId={item.itemId} count={item.count} />
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TaskRewardPreviewRow({ itemId, count }: { itemId: number; count: number }) {
  const name = useItemName(itemId);

  return (
    <div className="flex items-center gap-2 rounded-md border border-border p-2">
      <EntityThumb entityType="item" id={itemId} name={name ?? undefined} size="md" />
      <span className="text-sm">
        {name ?? "—"} <span className="text-muted-foreground">#{itemId}</span> × {count}
      </span>
    </div>
  );
}

