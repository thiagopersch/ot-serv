"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import useSWR from "swr";
import dayjs from "dayjs";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import { playerUpdateSchema, type PlayerUpdateInput } from "@/lib/validations/admin/player";
import { ACCOUNT_GROUPS } from "@/lib/account-groups";
import { uint32ToIp } from "@/lib/ip-address";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NumberField } from "@/components/shared/number-field";
import { MultiCheckboxField } from "@/components/shared/multi-checkbox-field";

type VocationOption = { id: number; name: string };
type TownOption = { id: number; name: string };

type PlayerReadOnly = {
  lastlogin: number;
  lastip: number;
  lastlogout: number;
  stamina: string;
  createdAt: string;
};

type PlayerFormProps = {
  playerId: number;
  initialValues: PlayerUpdateInput;
  readOnly: PlayerReadOnly;
};

function formatUnixOrNever(value: number) {
  return value > 0 ? dayjs.unix(value).format("DD/MM/YYYY HH:mm:ss") : "Nunca";
}

// Stamina é armazenada em milissegundos (config.lua do OTServer) — converte para HH:MM.
function formatStaminaMs(valueMs: string) {
  const totalMinutes = Math.floor(Number(valueMs) / 1000 / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}min`;
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

export function PlayerForm({ playerId, initialValues, readOnly }: PlayerFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: vocationsData } = useSWR<PaginatedResult<VocationOption>>(
    "/api/admin/vocations?pageSize=200",
    fetcher
  );
  const vocations = vocationsData?.data ?? [];

  const { data: townsData } = useSWR<{ data: TownOption[] }>("/api/admin/towns?all=true", fetcher);
  const towns = townsData?.data ?? [];

  const form = useForm<PlayerUpdateInput>({
    resolver: zodResolver(playerUpdateSchema),
    defaultValues: initialValues,
  });

  async function onSubmit(values: PlayerUpdateInput) {
    setIsSubmitting(true);

    const response = await fetch(`/api/admin/players/${playerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      toast.error(data?.error ?? "Não foi possível salvar o jogador.");
      return;
    }

    toast.success("Jogador atualizado.");
    router.push("/admin/players");
    router.refresh();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <Tabs defaultValue="identification">
          <TabsList className="flex-wrap">
            <TabsTrigger value="identification">Identificação</TabsTrigger>
            <TabsTrigger value="resources">Vida & recursos</TabsTrigger>
            <TabsTrigger value="position">Posição & skills</TabsTrigger>
            <TabsTrigger value="pvp">Perdas & PVP</TabsTrigger>
            <TabsTrigger value="outfit">Aparência</TabsTrigger>
            <TabsTrigger value="guild">Guild & cast</TabsTrigger>
            <TabsTrigger value="vocations">Vocações desbloqueadas</TabsTrigger>
            <TabsTrigger value="other">Outros</TabsTrigger>
            <TabsTrigger value="readonly">Somente leitura</TabsTrigger>
          </TabsList>

          <TabsContent value="identification">
            <Card>
              <CardHeader>
                <CardTitle>Identificação</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                <NumberField control={form.control} name="worldId" label="World ID" />
                <NumberField control={form.control} name="accountId" label="Account ID" />
                <FormField
                  control={form.control}
                  name="groupId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grupo</FormLabel>
                      <Select value={String(field.value)} onValueChange={(v) => v && field.onChange(Number(v))}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue>
                              {(value: string) => {
                                const group = ACCOUNT_GROUPS.find((g) => String(g.id) === value);
                                return group ? `${group.id} — ${group.name}` : value;
                              }}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ACCOUNT_GROUPS.map((group) => (
                            <SelectItem key={group.id} value={String(group.id)}>
                              {group.id} — {group.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <NumberField control={form.control} name="rankId" label="Rank ID" />
                <FormField
                  control={form.control}
                  name="vocation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vocação</FormLabel>
                      <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue>
                              {(value: string) =>
                                vocations.find((v) => String(v.id) === value)?.name ?? value
                              }
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {vocations.map((vocation) => (
                            <SelectItem key={vocation.id} value={String(vocation.id)}>
                              {vocation.id} — {vocation.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                      <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue>
                              {(value: string) => (value === "1" ? "Masculino" : value === "2" ? "Feminino" : value)}
                            </SelectValue>
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
                <NumberField control={form.control} name="level" label="Level" />
                <NumberField control={form.control} name="maglevel" label="Magic level" />
                <FormField
                  control={form.control}
                  name="online"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue>
                              {(value: string) => (value === "1" ? "Online" : "Offline")}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="0">Offline</SelectItem>
                          <SelectItem value="1">Online</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="deleted"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-2 self-end pb-2">
                      <FormControl>
                        <input
                          type="checkbox"
                          className="size-4"
                          checked={field.value !== 0}
                          onChange={(event) => field.onChange(event.target.checked ? 1 : 0)}
                        />
                      </FormControl>
                      <FormLabel className="!mt-0 font-normal">Deletado</FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="save"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-2 self-end pb-2">
                      <FormControl>
                        <input
                          type="checkbox"
                          className="size-4"
                          checked={field.value}
                          onChange={(event) => field.onChange(event.target.checked)}
                        />
                      </FormControl>
                      <FormLabel className="!mt-0 font-normal">Salvar personagem (save)</FormLabel>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resources">
            <Card>
              <CardHeader>
                <CardTitle>Vida</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <NumberField control={form.control} name="health" label="Health" />
                <NumberField control={form.control} name="healthmax" label="Health max" />
              </CardContent>
            </Card>
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Mana</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <NumberField control={form.control} name="mana" label="Mana" />
                <NumberField control={form.control} name="manamax" label="Mana max" />
                <NumberField control={form.control} name="manaspent" label="Mana spent" />
              </CardContent>
            </Card>
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Capacidade & Soul</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <NumberField control={form.control} name="cap" label="Capacidade" />
                <NumberField control={form.control} name="soul" label="Soul" />
              </CardContent>
            </Card>
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Demais recursos</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <NumberField control={form.control} name="experience" label="Experience" />
                <NumberField control={form.control} name="resets" label="Resets" />
                <NumberField control={form.control} name="skillPoints" label="Skill points" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="position">
            <Card>
              <CardHeader>
                <CardTitle>Posição</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <FormField
                  control={form.control}
                  name="townId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Town</FormLabel>
                      <Select value={String(field.value)} onValueChange={(v) => v && field.onChange(Number(v))}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue>
                              {(value: string) => {
                                const town = towns.find((t) => String(t.id) === value);
                                return town ? `#${town.id} — ${town.name}` : value;
                              }}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {towns.map((town) => (
                            <SelectItem key={town.id} value={String(town.id)}>
                              #{town.id} — {town.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <NumberField control={form.control} name="posx" label="Posição X" />
                <NumberField control={form.control} name="posy" label="Posição Y" />
                <NumberField control={form.control} name="posz" label="Posição Z" />
                <NumberField control={form.control} name="direction" label="Direção" />
              </CardContent>
            </Card>
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Skills</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <NumberField control={form.control} name="healthSkill" label="Health skill" />
                <NumberField control={form.control} name="manaSkill" label="Mana skill" />
                <NumberField control={form.control} name="bendSkill" label="Bend skill" />
                <NumberField control={form.control} name="dodgeSkill" label="Dodge skill" />
                <NumberField control={form.control} name="dodge" label="Dodge" />
                <NumberField control={form.control} name="critical" label="Critical" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pvp">
            <Card>
              <CardHeader>
                <CardTitle>Perdas (loss)</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <NumberField control={form.control} name="lossExperience" label="Loss experience" />
                <NumberField control={form.control} name="lossMana" label="Loss mana" />
                <NumberField control={form.control} name="lossSkills" label="Loss skills" />
                <NumberField control={form.control} name="lossContainers" label="Loss containers" />
                <NumberField control={form.control} name="lossItems" label="Loss items" />
              </CardContent>
            </Card>
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>PVP</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <NumberField control={form.control} name="skull" label="Skull" />
                <NumberField control={form.control} name="skulltime" label="Skull time" />
                <NumberField control={form.control} name="blessings" label="Blessings" />
                <NumberField control={form.control} name="marriage" label="Marriage" />
                <NumberField control={form.control} name="promotion" label="Promotion" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="outfit">
            <Card>
              <CardHeader>
                <CardTitle>Aparência (outfit)</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <NumberField control={form.control} name="looktype" label="Look type" />
                <NumberField control={form.control} name="lookhead" label="Look head" />
                <NumberField control={form.control} name="lookbody" label="Look body" />
                <NumberField control={form.control} name="looklegs" label="Look legs" />
                <NumberField control={form.control} name="lookfeet" label="Look feet" />
                <NumberField control={form.control} name="lookaddons" label="Look addons" />
                <NumberField control={form.control} name="lookmount" label="Look mount" />
                <NumberField control={form.control} name="lookwings" label="Look wings" />
                <NumberField control={form.control} name="lookaura" label="Look aura" />
                <NumberField control={form.control} name="lookshader" label="Look shader" />
                <NumberField control={form.control} name="lookhealthbar" label="Look health bar" />
                <NumberField control={form.control} name="lookmanabar" label="Look mana bar" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="guild">
            <Card>
              <CardHeader>
                <CardTitle>Guild & cast</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <FormField
                  control={form.control}
                  name="guildnick"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Guild nick</FormLabel>
                      <FormControl>
                        <Input maxLength={255} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <NumberField control={form.control} name="cast" label="Cast" />
                <NumberField control={form.control} name="castViewers" label="Cast viewers" />
                <FormField
                  control={form.control}
                  name="castDescription"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2 lg:col-span-3">
                      <FormLabel>Cast description</FormLabel>
                      <FormControl>
                        <Input maxLength={255} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vocations">
            <Card>
              <CardHeader>
                <CardTitle>Vocações desbloqueadas</CardTitle>
              </CardHeader>
              <CardContent>
                <MultiCheckboxField
                  control={form.control}
                  name="unlockedVocations"
                  options={vocations.map((v) => ({ value: v.id, label: v.name }))}
                  emptyLabel="Nenhuma vocação cadastrada ainda."
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="other">
            <Card>
              <CardHeader>
                <CardTitle>Outros</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <NumberField control={form.control} name="balance" label="Balance" />
                <NumberField control={form.control} name="premend" label="Prem end" />
                <NumberField control={form.control} name="age" label="Age" />
                <NumberField control={form.control} name="ageMinutes" label="Age minutes" />
                <NumberField control={form.control} name="onlineTime" label="Online time" />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2 lg:col-span-3">
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Input maxLength={255} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="readonly">
            <Card>
              <CardHeader>
                <CardTitle>Somente leitura</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <ReadOnlyField label="Último login" value={formatUnixOrNever(readOnly.lastlogin)} />
                <ReadOnlyField label="Último IP" value={readOnly.lastip > 0 ? uint32ToIp(readOnly.lastip) : "—"} />
                <ReadOnlyField label="Último logout" value={formatUnixOrNever(readOnly.lastlogout)} />
                <ReadOnlyField label="Stamina" value={formatStaminaMs(readOnly.stamina)} />
                <ReadOnlyField
                  label="Criado em"
                  value={dayjs(readOnly.createdAt).format("DD/MM/YYYY HH:mm:ss")}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            nativeButton={false}
            render={<Link href="/admin/players" />}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
