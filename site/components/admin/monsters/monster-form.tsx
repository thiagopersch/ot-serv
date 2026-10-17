"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import useSWR from "swr";

import {
  ELEMENT_KEYS,
  IMMUNITY_KEYS,
  MONSTER_RACES,
  MONSTER_RACE_COLORS,
  defaultMonsterValues,
  monsterFormSchema,
  type MonsterFormInput,
  type MonsterLootItemInput,
  type MonsterRace,
} from "@/lib/validations/admin/monster";
import { monsterToXml } from "@/lib/monster-xml";
import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
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
import { NumberField } from "@/components/shared/number-field";
import { ItemIdField } from "@/components/shared/item-id-field";
import { EntitySearchCombobox } from "@/components/shared/entity-search-combobox";
import { LooktypeAnimatedImage } from "@/components/shared/looktype-animated-image";
import { EntityThumb } from "@/components/shared/entity-thumb";
import { UniverseBadge } from "@/components/shared/universe-badge";
import { formatLooktypeOption } from "@/lib/validations/admin/looktype";
import { MonsterFlagsFields } from "@/components/admin/monsters/monster-flags-fields";
import { MonsterRecordGridField } from "@/components/admin/monsters/monster-record-grid-field";
import { MonsterSpellListField } from "@/components/admin/monsters/monster-spell-list-field";
import { MonsterSpellLinkField } from "@/components/admin/monsters/monster-spell-link-field";
import { MonsterVoiceListField } from "@/components/admin/monsters/monster-voice-list-field";
import { MonsterSummonListField } from "@/components/admin/monsters/monster-summon-list-field";
import { MonsterScriptListField } from "@/components/admin/monsters/monster-script-list-field";
import { MonsterLootListField } from "@/components/admin/monsters/monster-loot-list-field";
import { flattenLootItemIds } from "@/lib/monster-loot";
import { XmlPreviewCard } from "@/components/shared/xml-preview-card";

type LooktypeRow = {
  id: number;
  name: string;
  looktypeNumber: number | null;
  frameCount: number;
  frameDurationsMs: number[];
  updatedAt: string;
};

type MonsterFormProps = {
  monsterId?: number;
  initialValues?: MonsterFormInput;
};

export function MonsterForm({ monsterId, initialValues }: MonsterFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = monsterId != null;

  const form = useForm<MonsterFormInput, unknown, MonsterFormInput>({
    resolver: zodResolver(monsterFormSchema),
    defaultValues: initialValues ?? defaultMonsterValues,
  });

  const watched = useWatch({ control: form.control });

  // Mesma listagem já usada pelos comboboxes de spell (SWR dedupe pela chave, sem custo extra) —
  // resolve `words` das spells vinculadas para a pré-visualização do XML (ver resolveSpellName em monster-xml.ts).
  const { data: spellsData } = useSWR<
    PaginatedResult<{ id: number; words: string }>
  >("/api/admin/spells?pageSize=200", fetcher);
  const wordsBySpellId = Object.fromEntries(
    (spellsData?.data ?? []).map((spell) => [spell.id, spell.words]),
  );

  const { data: selectedLooktypeData } = useSWR<PaginatedResult<LooktypeRow>>(
    watched.lookTypeId ? `/api/admin/looktypes?id=${watched.lookTypeId}` : null,
    fetcher,
  );
  const selectedLooktype = selectedLooktypeData?.data.find((lt) => lt.id === watched.lookTypeId) ?? null;

  const { data: selectedUniverseData } = useSWR<PaginatedResult<{ id: number; name: string }>>(
    watched.universeId ? `/api/admin/universes?id=${watched.universeId}` : null,
    fetcher,
  );
  const selectedUniverse = selectedUniverseData?.data.find((u) => u.id === watched.universeId) ?? null;

  const previewXml = monsterToXml(
    { ...defaultMonsterValues, ...watched } as MonsterFormInput,
    wordsBySpellId,
    selectedLooktype?.looktypeNumber ?? null,
    selectedUniverse?.name ?? null,
  );

  async function onSubmit(values: MonsterFormInput) {
    setIsSubmitting(true);

    const url = isEditing
      ? `/api/admin/monsters/${monsterId}`
      : "/api/admin/monsters";
    const method = isEditing ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      toast.error(data?.error ?? "Não foi possível salvar o monstro.");
      return;
    }

    toast.success(isEditing ? "Monstro atualizado." : "Monstro criado.");
    router.push("/admin/monsters");
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
            <TabsList className="flex-wrap">
              <TabsTrigger value="basic">Básico</TabsTrigger>
              <TabsTrigger value="flags">Flags</TabsTrigger>
              <TabsTrigger value="attacks">Ataques</TabsTrigger>
              <TabsTrigger value="defenses">Defesas</TabsTrigger>
              <TabsTrigger value="spells">Spells</TabsTrigger>
              <TabsTrigger value="resist">Imunidades / elementos</TabsTrigger>
              <TabsTrigger value="voices">Vozes</TabsTrigger>
              <TabsTrigger value="loot">Loot</TabsTrigger>
              <TabsTrigger value="summons">Summons / script</TabsTrigger>
            </TabsList>

            <TabsContent value="basic">
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
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="nameDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição (nameDescription)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="a monster" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bestiary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bestiário (Bestiary)</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="monster">monster</SelectItem>
                            <SelectItem value="boss">boss</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="race"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Raça (Race)</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue>
                                {(value: string) => (
                                  <span className="flex items-center gap-1.5">
                                    <span
                                      className="size-2.5 rounded-full"
                                      style={{ backgroundColor: MONSTER_RACE_COLORS[value as MonsterRace] }}
                                    />
                                    {value}
                                  </span>
                                )}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {MONSTER_RACES.map((race) => (
                              <SelectItem key={race} value={race}>
                                <span className="flex items-center gap-1.5">
                                  <span
                                    className="size-2.5 rounded-full"
                                    style={{ backgroundColor: MONSTER_RACE_COLORS[race] }}
                                  />
                                  {race}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <NumberField
                    control={form.control}
                    name="experience"
                    label="Experiência (Experience)"
                  />
                  <NumberField
                    control={form.control}
                    name="speed"
                    label="Velocidade (Speed)"
                  />
                  <NumberField
                    control={form.control}
                    name="manacost"
                    label="Custo de mana (Manacost)"
                  />
                  <FormField
                    control={form.control}
                    name="universeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Universo</FormLabel>
                        <EntitySearchCombobox<{ id: number; name: string; color: string | null }>
                          endpoint="/api/admin/universes"
                          value={field.value}
                          placeholder="Buscar universo..."
                          formatOption={(row) => row.name}
                          renderOption={(row) => <UniverseBadge name={row.name} color={row.color} />}
                          onSelect={(row) => {
                            field.onChange(row?.id ?? null);
                            // `category` (pasta de organização) segue o universo — não é mais
                            // digitado à mão no formulário, só herdado da seleção do universo.
                            form.setValue("category", row?.name ?? "");
                          }}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="subcategory"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Subcategoria/subpasta (subcategory)
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder='ex.: "1-50" ou "bosses"'
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="published"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center gap-2 sm:col-span-2 lg:col-span-3">
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
                          Publicado (disponível nas páginas públicas de
                          gameplay)
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Dados de vida</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="healthNow"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vida atual (Health now)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            name={field.name}
                            ref={field.ref}
                            onBlur={field.onBlur}
                            value={(field.value as number | string) ?? ""}
                            onChange={(event) => {
                              const value = event.target.value === "" ? 0 : Number(event.target.value);
                              field.onChange(value);
                              // Pré-preenche a vida máxima com o mesmo valor — o usuário
                              // ainda pode ajustar `healthMax` manualmente depois.
                              form.setValue("healthMax", value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <NumberField
                    control={form.control}
                    name="healthMax"
                    label="Vida máxima (Health max)"
                  />
                </CardContent>
              </Card>

              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Outfit</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <ItemIdField
                    control={form.control}
                    name="lookTypeEx"
                    label="Tipo de aparência extra (Look typeex)"
                    nullable
                  />

                  <FormField
                    control={form.control}
                    name="lookTypeId"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-1 lg:col-span-3">
                        <FormLabel>Sprite vinculada (cadastro de looktypes)</FormLabel>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <EntitySearchCombobox<LooktypeRow>
                              endpoint="/api/admin/looktypes?category=outfit"
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
                          <div className="flex size-12 shrink-0 items-center justify-center rounded-md border border-border bg-muted/20">
                            {selectedLooktype ? (
                              <LooktypeAnimatedImage
                                key={selectedLooktype.id}
                                looktypeId={selectedLooktype.id}
                                frameCount={selectedLooktype.frameCount}
                                frameDurationsMs={selectedLooktype.frameDurationsMs}
                                updatedAt={selectedLooktype.updatedAt}
                                size="sm"
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <NumberField
                    control={form.control}
                    name="lookHead"
                    label="Cabeça (Head)"
                  />
                  <NumberField
                    control={form.control}
                    name="lookBody"
                    label="Corpo (Body)"
                  />
                  <NumberField
                    control={form.control}
                    name="lookLegs"
                    label="Pernas (Legs)"
                  />
                  <NumberField
                    control={form.control}
                    name="lookFeet"
                    label="Pés (Feet)"
                  />
                  <NumberField
                    control={form.control}
                    name="lookAddons"
                    label="Addons"
                  />
                  <ItemIdField
                    control={form.control}
                    name="corpse"
                    label="Item de corpo (Corpse)"
                  />
                </CardContent>
              </Card>

              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Target change</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <NumberField
                    control={form.control}
                    name="targetChangeInterval"
                    label="Intervalo (Interval)"
                  />
                  <NumberField
                    control={form.control}
                    name="targetChangeChance"
                    label="Chance"
                  />
                </CardContent>
              </Card>

              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Strategy</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <NumberField
                    control={form.control}
                    name="strategyAttack"
                    label="Ataque - boss (Attack)"
                  />
                  <NumberField
                    control={form.control}
                    name="strategyDefense"
                    label="Defesa - boss (Defense)"
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="flags">
              <Card>
                <CardHeader>
                  <CardTitle>Flags</CardTitle>
                </CardHeader>
                <CardContent>
                  <MonsterFlagsFields control={form.control} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="attacks">
              <Card>
                <CardHeader>
                  <CardTitle>Ataques</CardTitle>
                </CardHeader>
                <CardContent>
                  <MonsterSpellListField
                    control={form.control}
                    name="attacks"
                    addLabel="Adicionar ataque"
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="defenses">
              <Card>
                <CardHeader>
                  <CardTitle>Defesas</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <NumberField
                      control={form.control}
                      name="defenseArmor"
                      label="Armadura (Armor)"
                    />
                    <NumberField
                      control={form.control}
                      name="defenseValue"
                      label="Defesa (Defense)"
                    />
                  </div>
                  <MonsterSpellListField
                    control={form.control}
                    name="defenses"
                    addLabel="Adicionar defesa"
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="spells">
              <Card>
                <CardHeader>
                  <CardTitle>Spells vinculadas</CardTitle>
                </CardHeader>
                <CardContent>
                  <MonsterSpellLinkField
                    control={form.control}
                    name="linkedSpellIds"
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="resist">
              <Card>
                <CardHeader>
                  <CardTitle>Imunidades</CardTitle>
                </CardHeader>
                <CardContent>
                  <MonsterRecordGridField
                    control={form.control}
                    basePath="immunities"
                    keys={IMMUNITY_KEYS}
                  />
                </CardContent>
              </Card>
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Elementos</CardTitle>
                </CardHeader>
                <CardContent>
                  <MonsterRecordGridField
                    control={form.control}
                    basePath="elements"
                    keys={ELEMENT_KEYS}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="voices">
              <Card>
                <CardHeader>
                  <CardTitle>Vozes</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <NumberField
                      control={form.control}
                      name="voiceInterval"
                      label="Intervalo (Interval)"
                    />
                    <NumberField
                      control={form.control}
                      name="voiceChance"
                      label="Chance"
                    />
                  </div>
                  <MonsterVoiceListField control={form.control} name="voices" />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="loot">
              <Card>
                <CardHeader>
                  <CardTitle>Loot</CardTitle>
                </CardHeader>
                <CardContent>
                  <MonsterLootListField control={form.control} name="loot" />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="summons">
              <Card>
                <CardHeader>
                  <CardTitle>Summons</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <NumberField
                    control={form.control}
                    name="maxSummons"
                    label="Máximo de summons (Max summons)"
                  />
                  <MonsterSummonListField
                    control={form.control}
                    name="summons"
                  />
                </CardContent>
              </Card>
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Script (eventos Lua)</CardTitle>
                </CardHeader>
                <CardContent>
                  <MonsterScriptListField
                    control={form.control}
                    name="script"
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
              render={<Link href="/admin/monsters" />}
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
                  : "Criar monstro"}
            </Button>
          </div>
        </form>
      </Form>

      <div className="flex flex-col gap-6 lg:sticky lg:top-6">
        <XmlPreviewCard value={previewXml} />

        <Card className="h-fit">
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

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Loot</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const lootItemIds = flattenLootItemIds((watched.loot ?? []) as MonsterLootItemInput[]);
              return lootItemIds.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum item de loot ainda.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {lootItemIds.map((itemId, index) => (
                    <EntityThumb key={`${itemId}-${index}`} entityType="item" id={itemId} size="32" />
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
