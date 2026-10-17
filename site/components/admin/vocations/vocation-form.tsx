"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import useSWR from "swr";
import { toast } from "sonner";
import { X } from "lucide-react";

import { fetcher } from "@/lib/fetcher";
import type {
  VocationArchetype,
  Universe,
} from "@/lib/generated/prisma/client";
import type { PaginatedResult } from "@/lib/pagination";
import {
  defaultVocationValues,
  vocationSchema,
  type VocationInput,
} from "@/lib/validations/admin/vocation";
import { vocationToXml } from "@/lib/vocation-xml";
import { formatLooktypeOption } from "@/lib/validations/admin/looktype";
import { VOCATION_RANKS, VOCATION_RANK_LABELS, VOCATION_RANK_COLORS, type VocationRank } from "@/lib/vocation-rank";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { NumberField } from "@/components/shared/number-field";
import { XmlPreviewCard } from "@/components/shared/xml-preview-card";
import { EntitySearchCombobox } from "@/components/shared/entity-search-combobox";
import { EntityThumb } from "@/components/shared/entity-thumb";
import { LooktypeAnimatedImage } from "@/components/shared/looktype-animated-image";
import { VocationTypeSelect } from "@/components/admin/vocations/vocation-type-select";

type LooktypeRow = {
  id: number;
  name: string;
  looktypeNumber: number | null;
  frameCount: number;
  frameDurationsMs: number[];
  updatedAt: string;
};

type VocationFormProps = {
  vocationId?: number;
  initialValues?: VocationInput;
};

export function VocationForm({ vocationId, initialValues }: VocationFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = vocationId != null;

  const { data: archetypesData } = useSWR<PaginatedResult<VocationArchetype>>(
    "/api/admin/vocation-archetypes?pageSize=100",
    fetcher,
  );
  const { data: universesData } = useSWR<PaginatedResult<Universe>>(
    "/api/admin/universes?pageSize=100",
    fetcher,
  );

  const form = useForm<VocationInput, unknown, VocationInput>({
    resolver: zodResolver(vocationSchema),
    defaultValues: initialValues ?? defaultVocationValues,
  });

  const watched = useWatch({ control: form.control });

  const archetypeName =
    archetypesData?.data.find((item) => item.id === watched.archetypeId)?.name ??
    "";
  const typeUniverseName =
    universesData?.data.find((item) => item.id === watched.typeUniverseId)
      ?.name ?? "";

  const { data: selectedLooktypeData } = useSWR<PaginatedResult<LooktypeRow>>(
    watched.lookTypeId ? `/api/admin/looktypes?search=${watched.lookTypeId}&pageSize=5` : null,
    fetcher,
  );
  const selectedLooktype = selectedLooktypeData?.data.find((lt) => lt.id === watched.lookTypeId) ?? null;

  const previewXml = vocationToXml({
    ...defaultVocationValues,
    ...watched,
    formula: { ...defaultVocationValues.formula, ...watched.formula },
    skill: { ...defaultVocationValues.skill, ...watched.skill },
    archetypeName: archetypeName || null,
    typeUniverseName: typeUniverseName || "—",
  });

  async function onSubmit(values: VocationInput) {
    setIsSubmitting(true);

    const url = isEditing
      ? `/api/admin/vocations/${vocationId}`
      : "/api/admin/vocations";
    const method = isEditing ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      if (response.status === 409) {
        form.setError("id", { type: "manual", message: data?.error ?? "Já existe uma vocação com esse id." });
      }
      toast.error(data?.error ?? "Não foi possível salvar a vocação.");
      return;
    }

    toast.success(isEditing ? "Vocação atualizada." : "Vocação criada.");
    router.push("/admin/vocations");
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-6"
        >
          <Tabs defaultValue="basic">
            <TabsList>
              <TabsTrigger value="basic">Dados básicos</TabsTrigger>
              <TabsTrigger value="formula">Fórmula de habilidades</TabsTrigger>
              <TabsTrigger value="skill">Skills/Habilidades</TabsTrigger>
            </TabsList>

            <TabsContent value="basic">
              <Card>
                <CardHeader>
                  <CardTitle>Dados básicos</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <NumberField
                    control={form.control}
                    name="id"
                    label="ID"
                    disabled={isEditing}
                  />

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl>
                          <Input {...field} />
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
                        <FormLabel>Descrição</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <VocationTypeSelect
                    control={form.control}
                    name="archetypeId"
                    label="Arquétipo (archetype)"
                    placeholder="Selecione o arquétipo"
                    options={archetypesData?.data ?? []}
                  />

                  <VocationTypeSelect
                    control={form.control}
                    name="typeUniverseId"
                    label="Universo (type_universe)"
                    placeholder="Selecione o universo"
                    options={universesData?.data ?? []}
                  />

                  <FormField
                    control={form.control}
                    name="lookTypeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sprite (looktype)</FormLabel>
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <EntitySearchCombobox<LooktypeRow>
                              endpoint="/api/admin/looktypes"
                              value={field.value}
                              placeholder="Buscar looktype..."
                              formatOption={(lt) => formatLooktypeOption(lt)}
                              renderOption={(lt) => (
                                <span className="flex items-center gap-2">
                                  <LooktypeAnimatedImage
                                    key={lt.id}
                                    looktypeId={lt.id}
                                    frameCount={lt.frameCount}
                                    frameDurationsMs={lt.frameDurationsMs}
                                    updatedAt={lt.updatedAt}
                                    size="sm"
                                  />
                                  {formatLooktypeOption(lt)}
                                </span>
                              )}
                              onSelect={(lt) => field.onChange(lt?.id ?? null)}
                            />
                          </div>
                          {field.value != null && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              title="Remover sprite vinculada"
                              onClick={() => field.onChange(null)}
                            >
                              <X className="size-4" />
                            </Button>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maxRank"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rank máximo (upgrade por estrelas)</FormLabel>
                        <Select
                          value={String(field.value)}
                          onValueChange={(value) => field.onChange(Number(value))}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Selecione o rank">
                                {(value: string | null) => {
                                  const rank = value !== null ? (Number(value) as VocationRank) : null;
                                  if (rank === null) return "Selecione o rank";
                                  return (
                                    <span className="flex items-center gap-2">
                                      <span
                                        className="size-2.5 shrink-0 rounded-full"
                                        style={{ backgroundColor: VOCATION_RANK_COLORS[rank] }}
                                      />
                                      {VOCATION_RANK_LABELS[rank]}
                                    </span>
                                  );
                                }}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {VOCATION_RANKS.map((rank) => (
                              <SelectItem key={rank} value={String(rank)}>
                                <span className="flex items-center gap-2">
                                  <span
                                    className="size-2.5 shrink-0 rounded-full"
                                    style={{ backgroundColor: VOCATION_RANK_COLORS[rank] }}
                                  />
                                  {VOCATION_RANK_LABELS[rank]}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormItem>
                    <FormLabel>Fragmento específico (rank)</FormLabel>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <EntitySearchCombobox<{ id: number; name: string }>
                          endpoint="/api/admin/items"
                          value={watched.specificFragmentItemId ?? null}
                          placeholder="Buscar item..."
                          formatOption={(item) => `${item.name} (#${item.id})`}
                          renderOption={(item) => (
                            <span className="flex items-center gap-2">
                              <EntityThumb entityType="item" id={item.id} name={item.name} size="32" />
                              {item.name} (#{item.id})
                            </span>
                          )}
                          onSelect={(item) => form.setValue("specificFragmentItemId", item?.id ?? null)}
                        />
                      </div>
                      {!!watched.specificFragmentItemId && watched.specificFragmentItemId > 0 && (
                        <EntityThumb entityType="item" id={watched.specificFragmentItemId} size="32" />
                      )}
                    </div>
                    <FormField control={form.control} name="specificFragmentItemId" render={() => <FormMessage />} />
                  </FormItem>

                  <FormField
                    control={form.control}
                    name="needpremium"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center gap-2 sm:col-span-2">
                        <FormControl>
                          <input
                            type="checkbox"
                            className="size-4"
                            checked={field.value}
                            onChange={(event) =>
                              field.onChange(event.target.checked)
                            }
                          />
                        </FormControl>
                        <FormLabel className="!mt-0">
                          Requer premium (needpremium)
                        </FormLabel>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="published"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center gap-2 sm:col-span-2">
                        <FormControl>
                          <input
                            type="checkbox"
                            className="size-4"
                            checked={field.value}
                            onChange={(event) =>
                              field.onChange(event.target.checked)
                            }
                          />
                        </FormControl>
                        <FormLabel className="!mt-0">
                          Publicada (disponível para escolha na criação de
                          personagem no site)
                        </FormLabel>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="publishedGameplay"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center gap-2 sm:col-span-2">
                        <FormControl>
                          <input
                            type="checkbox"
                            className="size-4"
                            checked={field.value}
                            onChange={(event) =>
                              field.onChange(event.target.checked)
                            }
                          />
                        </FormControl>
                        <FormLabel className="!mt-0">
                          Publicada na sessão de Gameplay
                          (/gameplay/vocations)
                        </FormLabel>
                      </FormItem>
                    )}
                  />

                  <NumberField
                    control={form.control}
                    name="gaincap"
                    label="Ganho de capacidade (gaincap)"
                  />
                  <NumberField
                    control={form.control}
                    name="gainhp"
                    label="Ganho de vida (gainhp)"
                  />
                  <NumberField
                    control={form.control}
                    name="gainmana"
                    label="Ganho de mana (gainmana)"
                  />
                  <NumberField
                    control={form.control}
                    name="gainhpticks"
                    label="Intervalo de vida (gainhpticks)"
                  />
                  <NumberField
                    control={form.control}
                    name="gainhpamount"
                    label="Quantidade de vida (gainhpamount)"
                  />
                  <NumberField
                    control={form.control}
                    name="gainmanaticks"
                    label="Intervalo de mana (gainmanaticks)"
                  />
                  <NumberField
                    control={form.control}
                    name="gainmanaamount"
                    label="Quantidade de mana (gainmanaamount)"
                  />
                  <NumberField
                    control={form.control}
                    name="manamultiplier"
                    label="Multiplicador de mana (manamultiplier)"
                    step="0.1"
                  />
                  <NumberField
                    control={form.control}
                    name="attackspeed"
                    label="Velocidade de ataque (attackspeed)"
                  />
                  <NumberField
                    control={form.control}
                    name="soulmax"
                    label="Alma máxima (soulmax)"
                  />
                  <NumberField
                    control={form.control}
                    name="gainsoulticks"
                    label="Intervalo de alma (gainsoulticks)"
                  />
                  <NumberField
                    control={form.control}
                    name="fromvoc"
                    label="Vocação de origem (fromvoc)"
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="formula">
              <Card>
                <CardHeader>
                  <CardTitle>Fórmula de habilidades</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <NumberField
                    control={form.control}
                    name="formula.meleeDamage"
                    label="Dano corpo a corpo (formula_melee_damage)"
                    step="0.1"
                  />
                  <NumberField
                    control={form.control}
                    name="formula.distDamage"
                    label="Dano à distância (formula_dist_damage)"
                    step="0.1"
                  />
                  <NumberField
                    control={form.control}
                    name="formula.wandDamage"
                    label="Dano de varinha (formula_wand_damage)"
                    step="0.1"
                  />
                  <NumberField
                    control={form.control}
                    name="formula.magDamage"
                    label="Dano mágico (formula_mag_damage)"
                    step="0.1"
                  />
                  <NumberField
                    control={form.control}
                    name="formula.magHealingDamage"
                    label="Cura mágica (formula_mag_healing_damage)"
                    step="0.1"
                  />
                  <NumberField
                    control={form.control}
                    name="formula.defense"
                    label="Defesa (formula_defense)"
                    step="0.1"
                  />
                  <NumberField
                    control={form.control}
                    name="formula.magDefense"
                    label="Defesa mágica (formula_mag_defense)"
                    step="0.1"
                  />
                  <NumberField
                    control={form.control}
                    name="formula.armor"
                    label="Armadura (formula_armor)"
                    step="0.1"
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="skill">
              <Card>
                <CardHeader>
                  <CardTitle>Skills/Habilidades</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <NumberField
                    control={form.control}
                    name="skill.fist"
                    label="Punho (fist)"
                    step="0.1"
                  />
                  <NumberField
                    control={form.control}
                    name="skill.club"
                    label="Maça (club)"
                    step="0.1"
                  />
                  <NumberField
                    control={form.control}
                    name="skill.sword"
                    label="Espada (sword)"
                    step="0.1"
                  />
                  <NumberField
                    control={form.control}
                    name="skill.axe"
                    label="Machado (axe)"
                    step="0.1"
                  />
                  <NumberField
                    control={form.control}
                    name="skill.distance"
                    label="Distância (distance)"
                    step="0.1"
                  />
                  <NumberField
                    control={form.control}
                    name="skill.shielding"
                    label="Escudo (shielding)"
                    step="0.1"
                  />
                  <NumberField
                    control={form.control}
                    name="skill.fishing"
                    label="Pesca (fishing)"
                    step="0.1"
                  />
                  <NumberField
                    control={form.control}
                    name="skill.experience"
                    label="Experiência (experience)"
                    step="0.1"
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
              render={<Link href="/admin/vocations" />}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              {isSubmitting
                ? "Salvando..."
                : isEditing
                  ? "Salvar alterações"
                  : "Criar vocação"}
            </Button>
          </div>
        </form>
      </Form>

      <div className="flex flex-col gap-6 lg:sticky lg:top-6 lg:h-fit">
        <XmlPreviewCard value={previewXml} />

        <Card>
          <CardHeader>
            <CardTitle>Sprite vinculada</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            {selectedLooktype ? (
              <LooktypeAnimatedImage
                key={selectedLooktype.id}
                looktypeId={selectedLooktype.id}
                frameCount={selectedLooktype.frameCount}
                frameDurationsMs={selectedLooktype.frameDurationsMs}
                updatedAt={selectedLooktype.updatedAt}
                size="lg"
              />
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma sprite vinculada.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
