"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type DefaultValues, type FieldValues, type Path } from "react-hook-form";
import type { ZodType } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

export type SimpleField<T extends FieldValues> = {
  name: Path<T>;
  label: string;
  type?: "text" | "number" | "textarea" | "checkbox" | "color";
  disabled?: boolean;
};

type SimpleFormDialogProps<T extends FieldValues> = {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  schema: ZodType<T, T>;
  fields: SimpleField<T>[];
  defaultValues: T;
  onSubmit: (values: T) => Promise<boolean>;
  successMessage: string;
  errorMessage?: string;
};

export function SimpleFormDialog<T extends FieldValues>({
  trigger,
  title,
  description,
  schema,
  fields,
  defaultValues,
  onSubmit,
  successMessage,
  errorMessage = "Não foi possível salvar.",
}: SimpleFormDialogProps<T>) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<T, unknown, T>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as DefaultValues<T>,
  });

  useEffect(() => {
    if (open) {
      form.reset(defaultValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSubmit(values: T) {
    setIsSubmitting(true);
    const ok = await onSubmit(values);
    setIsSubmitting(false);

    if (!ok) {
      toast.error(errorMessage);
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
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4">
            {fields.map((fieldDef) => (
              <FormField
                key={fieldDef.name}
                control={form.control}
                name={fieldDef.name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{fieldDef.label}</FormLabel>
                    <FormControl>
                      {fieldDef.type === "textarea" ? (
                        <Textarea rows={4} disabled={fieldDef.disabled} {...field} />
                      ) : fieldDef.type === "color" ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            className="size-9 shrink-0 cursor-pointer rounded-md border border-input p-0.5"
                            disabled={fieldDef.disabled}
                            value={typeof field.value === "string" && field.value ? field.value : "#6b7280"}
                            onChange={(event) => field.onChange(event.target.value)}
                          />
                          <Input
                            type="text"
                            placeholder="#rrggbb"
                            disabled={fieldDef.disabled}
                            value={field.value ?? ""}
                            onChange={(event) => field.onChange(event.target.value || null)}
                          />
                        </div>
                      ) : fieldDef.type === "checkbox" ? (
                        <input
                          type="checkbox"
                          className="size-4"
                          checked={Boolean(field.value)}
                          disabled={fieldDef.disabled}
                          onChange={(event) => field.onChange(event.target.checked)}
                        />
                      ) : (
                        <Input
                          type={fieldDef.type === "number" ? "number" : "text"}
                          disabled={fieldDef.disabled}
                          {...field}
                          onChange={(event) =>
                            field.onChange(
                              fieldDef.type === "number"
                                ? Number(event.target.value)
                                : event.target.value
                            )
                          }
                        />
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            <DialogFooter>
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
