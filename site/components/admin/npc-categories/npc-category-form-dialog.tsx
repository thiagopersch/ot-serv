"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { npcCategorySchema, type NpcCategoryInput } from "@/lib/validations/admin/npc-category";
import { randomDistinctHexColor } from "@/lib/color-utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type NpcCategoryFormDialogProps = {
  trigger: React.ReactNode;
  title: string;
  defaultValues: NpcCategoryInput;
  onSubmit: (values: NpcCategoryInput) => Promise<boolean | "conflict">;
  successMessage: string;
  /** Só no trigger de criação — sorteia uma cor nova (diferente das já cadastradas) toda vez que
   * o diálogo abre, em vez de usar a cor estática de `defaultValues`. No de edição, ausente/false,
   * pra manter a cor já salva do registro. */
  randomizeColorOnOpen?: boolean;
  existingColors?: string[];
};

export function NpcCategoryFormDialog({
  trigger,
  title,
  defaultValues,
  onSubmit,
  successMessage,
  randomizeColorOnOpen = false,
  existingColors = [],
}: NpcCategoryFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<NpcCategoryInput, unknown, NpcCategoryInput>({
    resolver: zodResolver(npcCategorySchema),
    defaultValues,
  });

  useEffect(() => {
    if (!open) return;
    const color = randomizeColorOnOpen ? randomDistinctHexColor(existingColors) : defaultValues.color;
    form.reset({ ...defaultValues, color });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSubmit(values: NpcCategoryInput) {
    setIsSubmitting(true);
    const result = await onSubmit(values);
    setIsSubmitting(false);

    if (result === "conflict") {
      form.setError("name", { type: "manual", message: "Já existe uma categoria com esse nome." });
      toast.error("Já existe uma categoria com esse nome.");
      return;
    }

    if (!result) {
      toast.error("Não foi possível salvar.");
      return;
    }

    toast.success(successMessage);
    setOpen(false);
  }

  const color = form.watch("color");
  const description = form.watch("description") ?? "";

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
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex.: Lojistas, Quest..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Descrição</FormLabel>
                    <span className="text-xs text-muted-foreground">{description.length}/255</span>
                  </div>
                  <FormControl>
                    <Textarea maxLength={255} rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cor</FormLabel>
                  <div className="flex items-center gap-2">
                    <FormControl>
                      <input
                        type="color"
                        className="h-9 w-14 cursor-pointer rounded border border-input bg-background p-1"
                        value={color}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    </FormControl>
                    <Input {...field} className="font-mono" />
                  </div>
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
