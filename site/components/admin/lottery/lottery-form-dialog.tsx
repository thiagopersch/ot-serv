"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { lotterySchema, type LotteryInput } from "@/lib/validations/admin/lottery";
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
import { EntitySearchCombobox } from "@/components/shared/entity-search-combobox";
import { EntityThumb } from "@/components/shared/entity-thumb";
import { ItemThumbByName } from "@/components/shared/item-thumb-by-name";

type LotteryFormDialogProps = {
  trigger: React.ReactNode;
  title: string;
  defaultValues: LotteryInput;
  onSubmit: (values: LotteryInput) => Promise<boolean>;
  successMessage: string;
};

export function LotteryFormDialog({
  trigger,
  title,
  defaultValues,
  onSubmit,
  successMessage,
}: LotteryFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LotteryInput, unknown, LotteryInput>({
    resolver: zodResolver(lotterySchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) form.reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSubmit(values: LotteryInput) {
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Jogador vencedor</FormLabel>
                  <EntitySearchCombobox<{ id: number; name: string }>
                    endpoint="/api/admin/players"
                    value={null}
                    placeholder={field.value || "Buscar jogador..."}
                    formatOption={(player) => player.name}
                    onSelect={(player) => field.onChange(player?.name ?? "")}
                  />
                  <FormControl>
                    <input type="hidden" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="item"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item premiado</FormLabel>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <EntitySearchCombobox<{ id: number; name: string }>
                        endpoint="/api/admin/items"
                        value={null}
                        placeholder={field.value || "Buscar item por nome ou id..."}
                        formatOption={(item) => `${item.name} (#${item.id})`}
                        renderOption={(item) => (
                          <span className="flex items-center gap-2">
                            <EntityThumb entityType="item" id={item.id} name={item.name} size="32" />
                            {item.name} (#{item.id})
                          </span>
                        )}
                        onSelect={(item) => field.onChange(item?.name ?? "")}
                      />
                    </div>
                    {field.value && <ItemThumbByName name={field.value} size="32" />}
                  </div>
                  <FormControl>
                    <input type="hidden" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="sm:justify-between">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
