"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import useSWR from "swr";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import { houseUpdateSchema, type HouseUpdateInput } from "@/lib/validations/admin/house";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { NumberField } from "@/components/shared/number-field";
import { EntitySearchCombobox } from "@/components/shared/entity-search-combobox";

type TownOption = { id: number; name: string };

type HouseAuctionInfo = {
  bid: number;
  limit: number;
  endtime: number;
  player: { id: number; name: string };
} | null;

type HouseFormProps = {
  houseId: number;
  initialValues: HouseUpdateInput;
  ownerName: string | null;
  auction: HouseAuctionInfo;
  listCount: number;
};

export function HouseForm({ houseId, initialValues, ownerName, auction, listCount }: HouseFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: townsData } = useSWR<{ data: TownOption[] }>("/api/admin/towns?all=true", fetcher);
  const towns = townsData?.data ?? [];

  const form = useForm<HouseUpdateInput>({
    resolver: zodResolver(houseUpdateSchema),
    defaultValues: initialValues,
  });

  const owner = form.watch("owner");

  async function onSubmit(values: HouseUpdateInput) {
    setIsSubmitting(true);

    const response = await fetch(`/api/admin/houses/${houseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      toast.error(data?.error ?? "Não foi possível salvar a house.");
      return;
    }

    toast.success("House atualizada.");
    router.push("/admin/houses");
    router.refresh();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Identificação</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input maxLength={255} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="town"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Town</FormLabel>
                  <FormControl>
                    <select
                      className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                      value={field.value}
                      onChange={(event) => field.onChange(Number(event.target.value))}
                    >
                      <option value={0}>Sem town</option>
                      {towns.map((town) => (
                        <option key={town.id} value={town.id}>
                          {town.name}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormItem>
              <FormLabel>Dono</FormLabel>
              <EntitySearchCombobox<{ id: number; name: string }>
                endpoint="/api/admin/players"
                value={owner || null}
                formatOption={(player) => `#${player.id} — ${player.name}`}
                placeholder="Buscar personagem..."
                onSelect={(player) => form.setValue("owner", player?.id ?? 0)}
              />
              <p className="text-muted-foreground text-xs">
                {owner > 0 ? (ownerName ?? `#${owner}`) : "Sem dono"}
              </p>
            </FormItem>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aluguel & tamanho</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <NumberField control={form.control} name="price" label="Preço" />
            <NumberField control={form.control} name="rent" label="Rent" />
            <NumberField control={form.control} name="size" label="Tiles" />
            <FormField
              control={form.control}
              name="paid"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2">
                  <FormControl>
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={Boolean(field.value)}
                      onChange={(event) => field.onChange(event.target.checked ? 1 : 0)}
                    />
                  </FormControl>
                  <FormLabel className="!mt-0">Pago</FormLabel>
                </FormItem>
              )}
            />
            <NumberField control={form.control} name="warnings" label="Avisos" />
            <FormField
              control={form.control}
              name="guild"
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
                  <FormLabel className="!mt-0">Guild house</FormLabel>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="clear"
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
                  <FormLabel className="!mt-0">Marcada para limpar</FormLabel>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leilão & listas de acesso (somente leitura)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {auction ? (
              <>
                <div>
                  <p className="text-muted-foreground text-xs">Arrematante</p>
                  <p className="text-sm font-medium">
                    #{auction.player.id} — {auction.player.name}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Lance / Limite</p>
                  <p className="text-sm font-medium">
                    {auction.bid} / {auction.limit}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Encerra em (unix)</p>
                  <p className="text-sm font-medium">{auction.endtime}</p>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm sm:col-span-3">Sem leilão em andamento.</p>
            )}
            <div>
              <p className="text-muted-foreground text-xs">Listas de acesso cadastradas</p>
              <p className="text-sm font-medium">{listCount}</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
