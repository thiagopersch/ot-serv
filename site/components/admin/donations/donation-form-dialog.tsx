"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { donationSchema, type DonationInput } from "@/lib/validations/admin/donation";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { NumberField } from "@/components/shared/number-field";
import { EntitySearchCombobox } from "@/components/shared/entity-search-combobox";

type DonationFormDialogProps = {
  trigger: React.ReactNode;
  title: string;
  defaultValues: DonationInput;
  onSubmit: (values: DonationInput) => Promise<boolean>;
  successMessage: string;
};

export function DonationFormDialog({
  trigger,
  title,
  defaultValues,
  onSubmit,
  successMessage,
}: DonationFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<DonationInput, unknown, DonationInput>({
    resolver: zodResolver(donationSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) form.reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSubmit(values: DonationInput) {
    setIsSubmitting(true);
    const ok = await onSubmit(values);
    setIsSubmitting(false);

    if (!ok) {
      toast.error("Não foi possível registrar (verifique se a conta existe).");
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
              name="accountName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conta (login)</FormLabel>
                  <EntitySearchCombobox<{ id: number; name: string }>
                    endpoint="/api/admin/accounts"
                    value={null}
                    placeholder={field.value || "Buscar conta..."}
                    formatOption={(account) => account.name}
                    onSelect={(account) => field.onChange(account?.name ?? "")}
                  />
                  <FormControl>
                    <input type="hidden" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <NumberField control={form.control} name="amount" label="Valor (R$)" step="0.01" />
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observação (opcional)</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
