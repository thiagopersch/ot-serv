"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { defaultTownValues, townFormSchema, type TownFormInput } from "@/lib/validations/admin/town";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { NumberField } from "@/components/shared/number-field";

type TownFormProps = {
  isEditing?: boolean;
  initialValues?: TownFormInput;
};

export function TownForm({ isEditing = false, initialValues }: TownFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<TownFormInput, unknown, TownFormInput>({
    resolver: zodResolver(townFormSchema),
    defaultValues: initialValues ?? defaultTownValues,
  });

  async function onSubmit(values: TownFormInput) {
    setIsSubmitting(true);

    const url = isEditing ? `/api/admin/towns/${values.id}` : "/api/admin/towns";
    const method = isEditing ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      toast.error(data?.error ?? "Não foi possível salvar a town.");
      return;
    }

    toast.success(isEditing ? "Town atualizada." : "Town criada.");
    router.push("/admin/towns");
    router.refresh();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Dados básicos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <NumberField control={form.control} name="id" label="ID" disabled={isEditing} />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input {...field} maxLength={100} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="published"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2">
                  <FormControl>
                    <input
                      type="checkbox"
                      className="size-4 cursor-pointer"
                      checked={field.value}
                      onChange={(event) => field.onChange(event.target.checked)}
                    />
                  </FormControl>
                  <FormLabel className="!mt-0">Publicada (aparece em /gameplay/towns)</FormLabel>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Temple position</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <NumberField control={form.control} name="templeX" label="x" />
            <NumberField control={form.control} name="templeY" label="y" />
            <NumberField control={form.control} name="templeZ" label="z" />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            nativeButton={false}
            render={<Link href="/admin/towns" />}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar town"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
