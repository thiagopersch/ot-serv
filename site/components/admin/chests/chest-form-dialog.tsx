"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { chestSchema, MAX_CHEST_REWARD_SLOTS, type ChestInput } from "@/lib/validations/admin/chest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NumberField } from "@/components/shared/number-field";
import { EntitySearchCombobox } from "@/components/shared/entity-search-combobox";
import { EntityThumb } from "@/components/shared/entity-thumb";
import { FieldTooltip } from "@/components/shared/field-tooltip";
import { MonthYearFields } from "@/components/shared/month-year-fields";

type ChestFormDialogProps = {
  trigger: React.ReactNode;
  title: string;
  defaultValues: ChestInput;
  onSubmit: (values: ChestInput) => Promise<boolean>;
  successMessage: string;
};

export function ChestFormDialog({
  trigger,
  title,
  defaultValues,
  onSubmit,
  successMessage,
}: ChestFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ChestInput, unknown, ChestInput>({
    resolver: zodResolver(chestSchema),
    defaultValues,
  });

  const rewards = useFieldArray({ control: form.control, name: "rewards" });

  useEffect(() => {
    if (open) form.reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSubmit(values: ChestInput) {
    setIsSubmitting(true);
    const ok = await onSubmit(values);
    setIsSubmitting(false);

    if (!ok) {
      toast.error("Não foi possível salvar.");
      return;
    }

    toast.success(successMessage);
    setOpen(false);
  }

  const keyItemId = form.watch("keyItemId");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4">
            <Tabs defaultValue="identification">
              <TabsList>
                <TabsTrigger value="identification">Identificação</TabsTrigger>
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
                      <FormLabel className="font-normal">Publicado (ativo no sistema de baús)</FormLabel>
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

                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    Item-chave
                    <FieldTooltip text="Item consumido do inventário do jogador ao abrir o baú — sem ele, o baú não pode ser aberto." />
                  </FormLabel>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <EntitySearchCombobox<{ id: number; name: string }>
                        endpoint="/api/admin/items"
                        value={keyItemId || null}
                        placeholder="Buscar item..."
                        formatOption={(item) => `${item.name} (#${item.id})`}
                        renderOption={(item) => (
                          <span className="flex items-center gap-2">
                            <EntityThumb entityType="item" id={item.id} name={item.name} size="32" />
                            {item.name} (#{item.id})
                          </span>
                        )}
                        onSelect={(item) => form.setValue("keyItemId", item?.id ?? 0)}
                      />
                    </div>
                    {keyItemId > 0 && <EntityThumb entityType="item" id={keyItemId} size="32" />}
                  </div>
                  <FormField control={form.control} name="keyItemId" render={() => <FormMessage />} />
                </FormItem>

                <div className="flex flex-col gap-2 rounded-md border border-border p-3">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    Período de vigência
                    <FieldTooltip text="De/até quando esse baú fica disponível — permite ter vários baús configurados com prêmios diferentes, cada um valendo em um período (rotação de prêmios ao longo do tempo)." />
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-xs text-muted-foreground sm:col-span-2">Início</span>
                    <MonthYearFields control={form.control} yearName="startYear" monthName="startMonth" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-xs text-muted-foreground sm:col-span-2">Fim</span>
                    <MonthYearFields control={form.control} yearName="endYear" monthName="endMonth" />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="rewards" className="flex flex-col gap-4">
                <div className="flex flex-col gap-2 rounded-md border border-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      Recompensas (1 sorteada por vez, até {MAX_CHEST_REWARD_SLOTS})
                      <FieldTooltip text="Ao abrir o baú, o jogo sorteia 1 dessas opções com peso igual entre elas." />
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={rewards.fields.length >= MAX_CHEST_REWARD_SLOTS}
                      onClick={() => rewards.append({ itemId: 0, count: 1 })}
                    >
                      <Plus className="size-4" />
                      Adicionar
                    </Button>
                  </div>
                  {rewards.fields.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhuma recompensa adicionada.</p>
                  )}
                  {rewards.fields.map((rowField, index) => {
                    const itemId = form.watch(`rewards.${index}.itemId`);
                    return (
                      <div key={rowField.id} className="flex items-end gap-2">
                        {itemId > 0 && <EntityThumb entityType="item" id={itemId} size="32" />}
                        <div className="flex-1">
                          <FormField
                            control={form.control}
                            name={`rewards.${index}.itemId`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Item</FormLabel>
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
                          <NumberField control={form.control} name={`rewards.${index}.count`} label="Quantidade" />
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon-sm"
                          onClick={() => rewards.remove(index)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    );
                  })}
                  <FormField control={form.control} name="rewards" render={() => <FormMessage />} />
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="gap-4">
              <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
