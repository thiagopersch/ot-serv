"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import {
  customOutfitSchema,
  type CustomOutfitInput,
} from "@/lib/validations/admin/custom-outfit";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NumberField } from "@/components/shared/number-field";
import { EntitySearchCombobox } from "@/components/shared/entity-search-combobox";
import { EntityThumb } from "@/components/shared/entity-thumb";
import { LooktypeAnimatedImage } from "@/components/shared/looktype-animated-image";
import { FieldTooltip } from "@/components/shared/field-tooltip";
import { renderLooktypeOption } from "@/components/shared/outfit-looktype-search-field";
import {
  useOutfitLooktypeByNumber,
  type OutfitLooktypeRow,
} from "@/components/shared/use-outfit-looktype-by-number";
import { formatLooktypeOption } from "@/lib/validations/admin/looktype";

type ItemRow = { id: number; name: string; clientId?: number | null };

type CustomOutfitFormDialogProps = {
  trigger: React.ReactNode;
  title: string;
  defaultValues: CustomOutfitInput;
  /** Devolve a mensagem de erro (ou null em caso de sucesso). */
  onSubmit: (values: CustomOutfitInput) => Promise<string | null>;
  successMessage: string;
};

export function CustomOutfitFormDialog({
  trigger,
  title,
  defaultValues,
  onSubmit,
  successMessage,
}: CustomOutfitFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CustomOutfitInput, unknown, CustomOutfitInput>({
    resolver: zodResolver(customOutfitSchema),
    defaultValues,
  });
  const lookType = useWatch({ control: form.control, name: "lookType" });
  const itemId = useWatch({ control: form.control, name: "itemId" });
  // O form guarda o número da looktype no cliente; o combobox trabalha com o id do cadastro.
  const resolvedLooktype = useOutfitLooktypeByNumber(lookType);

  useEffect(() => {
    if (open) form.reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSubmit(values: CustomOutfitInput) {
    setIsSubmitting(true);
    const error = await onSubmit(values);
    setIsSubmitting(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success(successMessage);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      maxLength={60}
                      placeholder="Ex.: Armadura Dourada"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lookType"
              render={() => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    Looktype
                    <FieldTooltip
                      text={`Looktype vestido pelo jogador — liberado para qualquer vocação. Buscada no cadastro de looktypes (tipo Outfit).${lookType > 0 ? ` Nº salvo: ${lookType}.` : ""}`}
                    />
                  </FormLabel>
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <EntitySearchCombobox<OutfitLooktypeRow>
                        endpoint="/api/admin/looktypes?category=outfit"
                        value={resolvedLooktype?.id ?? null}
                        placeholder="Buscar looktype por nome ou número..."
                        formatOption={formatLooktypeOption}
                        renderOption={renderLooktypeOption}
                        onSelect={(looktype) => {
                          if (!looktype) {
                            form.setValue("lookType", 0, { shouldValidate: true });
                            return;
                          }
                          if (looktype.looktypeNumber === null) {
                            toast.error("Essa looktype não tem número no cliente.");
                            return;
                          }
                          form.setValue("lookType", looktype.looktypeNumber, { shouldValidate: true });
                          if (!form.getValues("name")) form.setValue("name", looktype.name.slice(0, 60));
                        }}
                      />
                    </div>
                    {resolvedLooktype && (
                      <LooktypeAnimatedImage
                        key={resolvedLooktype.id}
                        looktypeId={resolvedLooktype.id}
                        frameCount={resolvedLooktype.frameCount}
                        frameDurationsMs={resolvedLooktype.frameDurationsMs}
                        updatedAt={resolvedLooktype.updatedAt}
                        size="md"
                      />
                    )}
                  </div>
                  {lookType > 0 && resolvedLooktype === null && (
                    <p className="text-xs text-amber-500">
                      Looktype nº {lookType} não está no cadastro de looktypes.
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="itemId"
              render={() => (
                <FormItem>
                  <FormLabel>Item que libera o outfit</FormLabel>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <EntitySearchCombobox<ItemRow>
                        endpoint="/api/admin/items"
                        value={itemId || null}
                        placeholder="Buscar item..."
                        formatOption={(item) => `${item.name} (#${item.id})`}
                        renderOption={(item) => (
                          <span className="flex items-center gap-2">
                            <EntityThumb
                              entityType="item"
                              id={item.id}
                              name={item.name}
                              size="32"
                            />
                            {item.name} (#{item.id})
                          </span>
                        )}
                        onSelect={(item) => {
                          form.setValue("itemId", item?.id ?? 0, {
                            shouldValidate: true,
                          });
                          if (item?.clientId)
                            form.setValue("clientId", item.clientId);
                        }}
                      />
                    </div>
                    {itemId > 0 && (
                      <EntityThumb entityType="item" id={itemId} size="32" />
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <NumberField
              control={form.control}
              name="clientId"
              label="Client ID (sprite no cliente)"
              tooltip="Preenchido ao escolher o item (items.client_id)."
            />

            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem>
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={field.value}
                      onChange={(event) => field.onChange(event.target.checked)}
                    />
                    Ativo (inativo some do jogo, mas o jogador mantém a
                    liberação)
                  </label>
                </FormItem>
              )}
            />

            <DialogFooter className="sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
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
