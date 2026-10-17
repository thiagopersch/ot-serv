"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useForm,
  useWatch,
  type Control,
  type FieldPath,
} from "react-hook-form";
import useSWR from "swr";
import { toast } from "sonner";

import {
  BLOCK_TYPES,
  SPELL_GROUP_OPTIONS,
  SPELL_KINDS,
  defaultSpellValues,
  spellFormSchema,
  type BlockType,
  type SpellFormInput,
  type SpellKind,
} from "@/lib/validations/admin/spell";
import { spellToXml } from "@/lib/spell-xml";
import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import { formatLooktypeOption } from "@/lib/validations/admin/looktype";
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
import { ItemSearchField } from "@/components/shared/item-search-field";
import { EntityThumb } from "@/components/shared/entity-thumb";
import { EntitySearchCombobox } from "@/components/shared/entity-search-combobox";
import { LooktypeAnimatedImage } from "@/components/shared/looktype-animated-image";
import { XmlPreviewCard } from "@/components/shared/xml-preview-card";
import { Textarea } from "@/components/ui/textarea";
import { SpellVocationField } from "@/components/admin/spells/spell-vocation-field";

type LooktypeRow = {
  id: number;
  name: string;
  looktypeNumber: number | null;
  frameCount: number;
  frameDurationsMs: number[];
  updatedAt: string;
};

type SpellFormProps = {
  spellId?: number;
  initialValues?: SpellFormInput;
};

const KIND_LABELS: Record<SpellKind, string> = {
  instant: "Instant (feitiço direto)",
  rune: "Rune (item mágico)",
  conjure: "Conjure (invoca item)",
};

const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  "": "— nenhum —",
  all: "All (sólido e criatura)",
  solid: "Solid (só parede/objeto)",
  creature: "Creature (só criatura)",
};

const BEHAVIOR_FIELDS: {
  name: FieldPath<SpellFormInput>;
  label: string;
  kinds?: SpellKind[];
}[] = [
  { name: "enabled", label: "Habilitada (enabled)" },
  { name: "premium", label: "Requer premium (premium)" },
  { name: "aggressive", label: "Agressiva (aggressive)" },
  { name: "needTarget", label: "Precisa de alvo (needTarget)" },
  { name: "needWeapon", label: "Precisa de arma (needWeapon)" },
  { name: "selfTarget", label: "Alvo em si mesmo (selfTarget)" },
  { name: "needLearn", label: "Precisa aprender (needLearn)" },
  { name: "blockWalls", label: "Bloqueia por linha de visão (blockwalls)" },
  {
    name: "hasParam",
    label: "Aceita parâmetro (params)",
    kinds: ["instant", "conjure"],
  },
  {
    name: "needDirection",
    label: "Precisa de direção",
    kinds: ["instant", "conjure"],
  },
  {
    name: "casterTargetOrDirection",
    label: "Alvo do conjurador ou direção",
    kinds: ["instant", "conjure"],
  },
  {
    name: "allowFarUse",
    label: "Permite uso à distância (allowfaruse)",
    kinds: ["rune"],
  },
  { name: "hasCharges", label: "Possui cargas (charges)", kinds: ["rune"] },
];

function NullableNumberField({
  control,
  name,
  label,
}: {
  control: Control<SpellFormInput>;
  name: FieldPath<SpellFormInput>;
  label: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type="number"
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              value={(field.value as number | null) ?? ""}
              onChange={(event) =>
                field.onChange(
                  event.target.value === "" ? null : Number(event.target.value),
                )
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function SpellForm({ spellId, initialValues }: SpellFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = spellId != null;

  const form = useForm<SpellFormInput, unknown, SpellFormInput>({
    resolver: zodResolver(spellFormSchema),
    defaultValues: initialValues ?? defaultSpellValues,
  });

  const watched = useWatch({ control: form.control });
  const { data: vocationsData } = useSWR<PaginatedResult<{ id: number; name: string }>>(
    "/api/admin/vocations?pageSize=200",
    fetcher,
  );
  const vocationNameById = new Map((vocationsData?.data ?? []).map((voc) => [voc.id, voc.name]));
  const previewXml = spellToXml(
    {
      ...defaultSpellValues,
      ...watched,
    } as SpellFormInput,
    vocationNameById,
  );
  const currentKind = (watched.kind ?? "instant") as SpellKind;

  const { data: selectedLooktypeData } = useSWR<PaginatedResult<LooktypeRow>>(
    watched.lookTypeId ? `/api/admin/looktypes?search=${watched.lookTypeId}&pageSize=5` : null,
    fetcher,
  );
  const selectedLooktype = selectedLooktypeData?.data.find((lt) => lt.id === watched.lookTypeId) ?? null;
  const spellItemId = currentKind === "rune" ? watched.runeItemId : currentKind === "conjure" ? watched.conjureId : null;

  async function onSubmit(values: SpellFormInput) {
    setIsSubmitting(true);

    const url = isEditing
      ? `/api/admin/spells/${spellId}`
      : "/api/admin/spells";
    const method = isEditing ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      toast.error(data?.error ?? "Não foi possível salvar a spell.");
      return;
    }

    toast.success(isEditing ? "Spell atualizada." : "Spell criada.");
    router.push("/admin/spells");
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
              <TabsTrigger value="behavior">Comportamento</TabsTrigger>
              <TabsTrigger value="script">Script</TabsTrigger>
              <TabsTrigger value="vocations">Vocações</TabsTrigger>
            </TabsList>

            <TabsContent value="basic">
              <Card>
                <CardHeader>
                  <CardTitle>Dados básicos</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="published"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center gap-2">
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
                          Publicada (disponível nas páginas públicas de
                          gameplay)
                        </FormLabel>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="group"
                    render={({ field }) => {
                      const selected = field.value
                        ? (field.value as string).split(",").filter(Boolean)
                        : [];

                      function toggle(option: string) {
                        if (selected.includes(option)) {
                          field.onChange(
                            selected
                              .filter((value) => value !== option)
                              .join(","),
                          );
                        } else {
                          field.onChange([...selected, option].join(","));
                        }
                      }

                      return (
                        <FormItem>
                          <FormLabel>Grupo (group)</FormLabel>
                          <div className="flex flex-wrap gap-x-4 gap-y-2">
                            {SPELL_GROUP_OPTIONS.map((option) => (
                              <label
                                key={option}
                                className="flex items-center gap-1.5 text-sm"
                              >
                                <input
                                  type="checkbox"
                                  className="size-4"
                                  checked={selected.includes(option)}
                                  onChange={() => toggle(option)}
                                />
                                {option}
                              </label>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />

                  <FormField
                    control={form.control}
                    name="kind"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo (kind)</FormLabel>
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
                            {SPELL_KINDS.map((kind) => (
                              <SelectItem key={kind} value={kind}>
                                {KIND_LABELS[kind]}
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
                    name="lookTypeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sprite vinculada (cadastro de looktypes)</FormLabel>
                        <div className="flex items-center gap-3">
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

                  {currentKind === "rune" ? (
                    <ItemSearchField
                      control={form.control}
                      name="runeItemId"
                      label="Item da rune (id)"
                    />
                  ) : (
                    <FormField
                      control={form.control}
                      name="words"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Palavras mágicas (words)</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <NumberField
                    control={form.control}
                    name="level"
                    label="Nível (Level)"
                  />
                  <NumberField
                    control={form.control}
                    name="magicLevel"
                    label="Nível mágico (Magic level)"
                  />
                  <NumberField
                    control={form.control}
                    name="mana"
                    label="Mana"
                  />
                  <NumberField
                    control={form.control}
                    name="manaPercent"
                    label="Mana %"
                  />
                  <NumberField
                    control={form.control}
                    name="soul"
                    label="Alma (Soul)"
                  />
                  <FormField
                    control={form.control}
                    name="exhaustion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Exaustão em segundos (Exhaustion)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            name={field.name}
                            ref={field.ref}
                            onBlur={field.onBlur}
                            value={field.value ? field.value / 1000 : ""}
                            onChange={(event) =>
                              field.onChange(
                                event.target.value === "" ? 0 : Math.round(Number(event.target.value) * 1000),
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <NumberField
                    control={form.control}
                    name="range"
                    label="Alcance (Range)"
                  />

                  <FormField
                    control={form.control}
                    name="blockType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de bloqueio (Block type)</FormLabel>
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
                            {BLOCK_TYPES.map((type) => (
                              <SelectItem key={type || "none"} value={type}>
                                {BLOCK_TYPE_LABELS[type]}
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
                    name="description"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Descrição</FormLabel>
                        <FormControl>
                          <Textarea {...field} maxLength={255} rows={3} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="behavior">
              <Card>
                <CardHeader>
                  <CardTitle>Comportamento</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  {currentKind !== "rune" && (
                    <NumberField
                      control={form.control}
                      name="limitRange"
                      label="Alcance limite (Limit range)"
                    />
                  )}

                  {BEHAVIOR_FIELDS.filter(
                    (item) => !item.kinds || item.kinds.includes(currentKind),
                  ).map(({ name, label }) => (
                    <FormField
                      key={name}
                      control={form.control}
                      name={name}
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center gap-2">
                          <FormControl>
                            <input
                              type="checkbox"
                              className="size-4"
                              checked={Boolean(field.value)}
                              onChange={(event) =>
                                field.onChange(event.target.checked)
                              }
                            />
                          </FormControl>
                          <FormLabel className="!mt-0">{label}</FormLabel>
                        </FormItem>
                      )}
                    />
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="script">
              <Card>
                <CardHeader>
                  <CardTitle>Script</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="event"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Evento (event)</FormLabel>
                        <FormControl>
                          <Input placeholder="script" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="scriptValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Caminho do script (value)</FormLabel>
                        <FormControl>
                          <Input placeholder="attacks/exemplo.lua" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="functionName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Função nativa (function)</FormLabel>
                        <FormControl>
                          <Input placeholder="conjureItem" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {currentKind === "conjure" && (
                    <>
                      <ItemSearchField
                        control={form.control}
                        name="conjureId"
                        label="Item conjurado (conjureId)"
                      />
                      <NullableNumberField
                        control={form.control}
                        name="conjureCount"
                        label="Quantidade (conjureCount)"
                      />
                      <ItemSearchField
                        control={form.control}
                        name="conjureReagentId"
                        label="Reagente (reagentId)"
                      />
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="vocations">
              <Card>
                <CardHeader>
                  <CardTitle>Vocações</CardTitle>
                </CardHeader>
                <CardContent>
                  <SpellVocationField control={form.control} name="vocations" />
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
              render={<Link href="/admin/spells" />}
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
                  : "Criar spell"}
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
          <CardContent className="flex flex-col items-center gap-4">
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

            {spellItemId != null && spellItemId > 0 && (
              <div className="flex flex-col items-center gap-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {currentKind === "rune" ? "Item da rune" : "Item conjurado"}
                </p>
                <EntityThumb entityType="item" id={spellItemId} size="lg" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
