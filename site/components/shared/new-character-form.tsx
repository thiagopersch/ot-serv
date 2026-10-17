"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import useSWR from "swr";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import { createCharacterSchema, type CreateCharacterInput } from "@/lib/validations/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

type VocationOption = { id: number; name: string; typeUniverse: { name: string } | null };

const NO_UNIVERSE_LABEL = "Sem universo";

/** Agrupa por universo mantendo a ordem já vinda da API (universo asc, depois nome asc) —
 * sem universo fica num grupo à parte, sempre por último. */
function groupVocationsByUniverse(vocations: VocationOption[]): [string, VocationOption[]][] {
  const groups = new Map<string, VocationOption[]>();
  for (const vocation of vocations) {
    const label = vocation.typeUniverse?.name ?? NO_UNIVERSE_LABEL;
    const group = groups.get(label);
    if (group) {
      group.push(vocation);
    } else {
      groups.set(label, [vocation]);
    }
  }

  const entries = [...groups.entries()];
  entries.sort(([a], [b]) => (a === NO_UNIVERSE_LABEL ? 1 : b === NO_UNIVERSE_LABEL ? -1 : 0));
  return entries;
}

const SEX_LABELS: Record<string, string> = {
  "1": "Masculino",
  "2": "Feminino",
};

export function NewCharacterForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data, isLoading: isLoadingVocations } = useSWR<{ vocations: VocationOption[] }>(
    "/api/account/vocations",
    fetcher
  );
  const vocations = data?.vocations ?? [];
  const hasVocations = !isLoadingVocations && vocations.length > 0;
  const vocationNameById = new Map(vocations.map((vocation) => [String(vocation.id), vocation.name]));
  const vocationGroups = groupVocationsByUniverse(vocations);

  const form = useForm<CreateCharacterInput>({
    resolver: zodResolver(createCharacterSchema),
    defaultValues: { name: "", sex: 1, vocationId: 0 },
  });

  async function onSubmit(values: CreateCharacterInput) {
    if (!vocations.some((vocation) => vocation.id === values.vocationId)) {
      form.setError("vocationId", {
        type: "manual",
        message: "Selecione uma vocação válida entre as disponíveis.",
      });
      return;
    }

    setIsSubmitting(true);

    const response = await fetch("/api/account/characters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      toast.error(body?.error ?? "Não foi possível criar o personagem.");
      return;
    }

    toast.success("Personagem criado.");
    router.push("/account");
    router.refresh();
  }

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>Criar personagem</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do personagem</FormLabel>
                  <FormControl>
                    <Input maxLength={35} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sex"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sexo</FormLabel>
                  <Select
                    value={String(field.value)}
                    onValueChange={(value) => field.onChange(Number(value))}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>{(value: string) => SEX_LABELS[value] ?? value}</SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="1">Masculino</SelectItem>
                      <SelectItem value="2">Feminino</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="vocationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vocação</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : null}
                    onValueChange={(value) => field.onChange(value ? Number(value) : 0)}
                    disabled={!hasVocations}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione a vocação">
                          {(value: string | null) => (value ? (vocationNameById.get(value) ?? value) : "Selecione a vocação")}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {hasVocations ? (
                        vocationGroups.map(([universeName, groupVocations]) => (
                          <SelectGroup key={universeName}>
                            <SelectLabel>{universeName}</SelectLabel>
                            {groupVocations.map((vocation) => (
                              <SelectItem key={vocation.id} value={String(vocation.id)}>
                                {vocation.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))
                      ) : (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          Nenhuma vocação disponível no momento.
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="outline" nativeButton={false} render={<Link href="/account" />}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Criando..." : "Criar Personagem"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
