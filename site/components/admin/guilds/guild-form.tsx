"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { guildUpdateSchema, type GuildUpdateInput } from "@/lib/validations/admin/guild";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { NumberField } from "@/components/shared/number-field";
import { EntitySearchCombobox } from "@/components/shared/entity-search-combobox";

type WarInfo = { id: number; enemyName: string; frags: number; guildKills: number; enemyKills: number; status: number };
type InviteInfo = { player: { id: number; name: string } };

type GuildFormProps = {
  guildId: number;
  initialValues: GuildUpdateInput;
  ownerName: string;
  wars: WarInfo[];
  invites: InviteInfo[];
};

export function GuildForm({ guildId, initialValues, ownerName, wars, invites }: GuildFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<GuildUpdateInput>({
    resolver: zodResolver(guildUpdateSchema),
    defaultValues: initialValues,
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "ranks" });

  const ownerId = form.watch("ownerId");

  async function onSubmit(values: GuildUpdateInput) {
    setIsSubmitting(true);

    const response = await fetch(`/api/admin/guilds/${guildId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      toast.error(data?.error ?? "Não foi possível salvar a guild.");
      return;
    }

    toast.success("Guild atualizada.");
    router.push("/admin/guilds");
    router.refresh();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Identificação</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input maxLength={255} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormItem>
              <FormLabel>Dono</FormLabel>
              <EntitySearchCombobox<{ id: number; name: string }>
                endpoint="/api/admin/players"
                value={ownerId || null}
                formatOption={(player) => `#${player.id} — ${player.name}`}
                placeholder="Buscar personagem..."
                onSelect={(player) => form.setValue("ownerId", player?.id ?? 0)}
              />
              <p className="text-muted-foreground text-xs">
                {ownerId > 0 ? ownerName : "Selecione o novo dono"}
              </p>
            </FormItem>
            <FormField
              control={form.control}
              name="motd"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>MOTD</FormLabel>
                  <FormControl>
                    <Input maxLength={255} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Ranks</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => append({ name: "", level: 1 })}>
              <Plus className="size-4" />
              Adicionar rank
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {fields.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum rank cadastrado.</p>
            ) : (
              fields.map((field, index) => (
                <div key={field.id} className="flex items-end gap-2">
                  <FormField
                    control={form.control}
                    name={`ranks.${index}.name`}
                    render={({ field: nameField }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Nome do rank</FormLabel>
                        <FormControl>
                          <Input maxLength={255} {...nameField} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <NumberField control={form.control} name={`ranks.${index}.level`} label="Nível" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive"
                    onClick={() => remove(index)}
                    title="Remover rank"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Guerras & convites (somente leitura)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Guerras</p>
              {wars.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhuma guerra registrada.</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {wars.map((war) => (
                    <p key={war.id} className="text-sm">
                      vs. <span className="font-medium">{war.enemyName}</span> — frags {war.frags} (
                      {war.guildKills}×{war.enemyKills}) — status {war.status}
                    </p>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Convites pendentes</p>
              {invites.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum convite pendente.</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {invites.map((invite) => (
                    <p key={invite.player.id} className="text-sm">
                      #{invite.player.id} — {invite.player.name}
                    </p>
                  ))}
                </div>
              )}
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
