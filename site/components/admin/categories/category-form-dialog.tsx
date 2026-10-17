"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { categorySchema, type CategoryInput } from "@/lib/validations/admin/category";
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

type CategoryFormDialogProps = {
  trigger: React.ReactNode;
  title: string;
  defaultValues: CategoryInput;
  onSubmit: (values: CategoryInput) => Promise<boolean | "conflict">;
  successMessage: string;
};

export function CategoryFormDialog({ trigger, title, defaultValues, onSubmit, successMessage }: CategoryFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CategoryInput, unknown, CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) form.reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSubmit(values: CategoryInput) {
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
                    <Input placeholder="Ex.: Dragon Ball, Bleach..." {...field} />
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
