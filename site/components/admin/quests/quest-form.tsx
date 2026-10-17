"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { questSchema, type QuestInput } from "@/lib/validations/admin/quest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NumberField } from "@/components/shared/number-field";
import { EntityThumb } from "@/components/shared/entity-thumb";
import { useItemName } from "@/components/shared/use-item-name";
import { CategorySelect } from "@/components/admin/categories/category-select";
import { QuestImageUpload } from "@/components/admin/quests/quest-image-upload";
import { QuestRewardItemListField } from "@/components/admin/quests/quest-reward-item-list-field";

type QuestFormProps = {
  questId?: number;
  imageUrl?: string | null;
  defaultValues: QuestInput;
  onSubmit: (values: QuestInput) => Promise<boolean>;
  successMessage: string;
};

export function QuestForm({ questId, imageUrl, defaultValues, onSubmit, successMessage }: QuestFormProps) {
  const router = useRouter();
  const isEditing = questId != null;

  const form = useForm<QuestInput, unknown, QuestInput>({
    resolver: zodResolver(questSchema),
    defaultValues,
  });

  const watchedRewardItems = useWatch({ control: form.control, name: "rewardItems" }) ?? [];

  async function handleSubmit(values: QuestInput) {
    const ok = await onSubmit(values);

    if (!ok) {
      toast.error("Não foi possível salvar.");
      return;
    }

    toast.success(successMessage);
    router.push("/admin/quests");
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4">
          <Tabs defaultValue="identification">
            <TabsList>
              <TabsTrigger value="identification">Identificação</TabsTrigger>
              <TabsTrigger value="rewards">Recompensas</TabsTrigger>
              <TabsTrigger value="image">Imagem</TabsTrigger>
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
                    <FormLabel className="!mt-0">Publicada (visível para os jogadores)</FormLabel>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <CategorySelect control={form.control} name="categoryId" />
                <NumberField control={form.control} name="levelRequired" label="Level mínimo" />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea rows={4} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </TabsContent>

            <TabsContent value="rewards" className="flex flex-col gap-4">
              <NumberField control={form.control} name="rewardExp" label="Quantidade de Experiência" />

              <div className="flex flex-col gap-2 rounded-md border border-border p-3">
                <span className="text-sm font-medium">Itens de recompensa</span>
                <QuestRewardItemListField control={form.control} name="rewardItems" />
              </div>
            </TabsContent>

            <TabsContent value="image">
              {isEditing ? (
                <QuestImageUpload questId={questId} imageUrl={imageUrl ?? null} onChange={() => router.refresh()} />
              ) : (
                <p className="text-sm text-muted-foreground">Salve a quest primeiro para poder enviar uma imagem.</p>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" onClick={() => router.push("/admin/quests")}>
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
                    <QuestRewardPreviewRow key={`${item.itemId}-${index}`} itemId={item.itemId} count={item.count} />
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QuestRewardPreviewRow({ itemId, count }: { itemId: number; count: number }) {
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
