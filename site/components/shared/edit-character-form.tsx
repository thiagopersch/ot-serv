"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import useSWR from "swr";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import { characterCommentSchema, type CharacterCommentInput } from "@/lib/validations/account";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

type CharacterDetail = { id: number; name: string; description: string };

export function EditCharacterForm({ characterId }: { characterId: number }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data, isLoading } = useSWR<{ player: CharacterDetail }>(
    `/api/account/characters/${characterId}`,
    fetcher
  );

  const form = useForm<CharacterCommentInput>({
    resolver: zodResolver(characterCommentSchema),
    values: { description: data?.player.description ?? "" },
  });

  const description = form.watch("description") ?? "";

  async function onSubmit(values: CharacterCommentInput) {
    setIsSubmitting(true);

    const response = await fetch(`/api/account/characters/${characterId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      toast.error(body?.error ?? "Não foi possível salvar.");
      return;
    }

    toast.success("Personagem atualizado.");
    router.push("/account");
    router.refresh();
  }

  if (isLoading || !data) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>Editar personagem</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>Editar personagem: {data.player.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comentário</FormLabel>
                  <FormControl>
                    <Textarea rows={6} maxLength={255} {...field} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">{description.length}/255 caracteres</p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="outline" nativeButton={false} render={<Link href="/account" />}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
