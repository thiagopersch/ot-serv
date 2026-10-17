"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import useSWR from "swr";
import { toast } from "sonner";
import { X } from "lucide-react";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import { buildNpcXml, needsOwnScript, resolveScriptContent } from "@/lib/npc-xml";
import { textColorFor } from "@/lib/color-utils";
import { npcSchema, NPC_TYPES, type NpcInput, type NpcShopItemInput } from "@/lib/validations/admin/npc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CollapsibleSectionCard } from "@/components/shared/collapsible-section-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NumberField } from "@/components/shared/number-field";
import { OptionRadioField } from "@/components/shared/option-radio-field";
import { TibiaColorPickerField } from "@/components/shared/tibia-color-picker-field";
import { EntitySearchCombobox } from "@/components/shared/entity-search-combobox";
import { LooktypeAnimatedImage } from "@/components/shared/looktype-animated-image";
import { OutfitColorPreview } from "@/components/shared/outfit-color-preview";
import { EntityThumb } from "@/components/shared/entity-thumb";
import { FieldTooltip } from "@/components/shared/field-tooltip";
import { NpcCustomMessageListField } from "@/components/admin/npcs/npc-custom-message-list-field";
import { NpcDefaultMessageFields } from "@/components/admin/npcs/npc-default-message-fields";
import { NpcShopItemListField } from "@/components/admin/npcs/npc-shop-item-list-field";
import { XmlPreviewCard } from "@/components/shared/xml-preview-card";
import { LuaScriptPreviewCard } from "@/components/shared/lua-script-preview-card";
import { formatLooktypeOption } from "@/lib/validations/admin/looktype";

type LooktypeRow = {
  id: number;
  name: string;
  looktypeNumber: number | null;
  frameCount: number;
  frameDurationsMs: number[];
  updatedAt: string;
  directions: number;
  hasColorMask: boolean;
  addonSlots: number;
};

type TownRow = { id: number; name: string };
type LuaScriptRow = { id: number; name: string; content: string };
type NpcCategoryRow = { id: number; name: string; color: string };

const NPC_TYPE_LABELS: Record<(typeof NPC_TYPES)[number], string> = {
  shop: "Loja (vende/compra itens, sem script customizado)",
  quest: "Quest (usa script Lua customizado)",
  misc: "Outro (usa script Lua customizado)",
};

const defaultValues: NpcInput = {
  name: "",
  lookTypeId: 0,
  type: "shop",
  town: "",
  posX: 0,
  posY: 0,
  posZ: 7,
  direction: 2,
  walkinterval: 0,
  lookHead: 0,
  lookBody: 0,
  lookLegs: 0,
  lookFeet: 0,
  lookAddons: 3,
  shopItems: [],
  scriptId: null,
  categoryId: null,
  customMessages: [],
  /** Modelo comum pré-preenchido pra novos NPCs — admin edita/apaga à vontade; NPCs já
   * existentes sempre carregam o que está salvo (ver `normalizeDefaultMessages`). */
  defaultMessages: {
    message_greet: "Hello, |PLAYERNAME|! How can I help you?",
    message_farewell: "Good bye, |PLAYERNAME|!",
    message_decline: "Ok then.",
    message_walkaway: "Come back when you are ready.",
    message_idletimeout: "Sorry, I don't have all day. Bye then.",
    message_alreadyfocused: "I am already talking to someone else, please wait.",
    message_placedinqueue: "You have been placed in the talking queue. I will be with you shortly.",
  },
  published: true,
};

type NpcFormProps = {
  npcId?: number;
  initialValues?: NpcInput;
};

export function NpcForm({ npcId, initialValues }: NpcFormProps) {
  const router = useRouter();

  const form = useForm<NpcInput, unknown, NpcInput>({
    resolver: zodResolver(npcSchema),
    defaultValues: initialValues ?? defaultValues,
  });

  const watched = useWatch({ control: form.control });
  const type = watched.type;
  const lookTypeId = watched.lookTypeId;
  const scriptId = watched.scriptId;

  const { data: selectedLooktypeData } = useSWR<PaginatedResult<LooktypeRow>>(
    lookTypeId ? `/api/admin/looktypes?search=${lookTypeId}&pageSize=5` : null,
    fetcher,
  );
  const selectedLooktype = selectedLooktypeData?.data.find((lt) => lt.id === lookTypeId) ?? null;

  const { data: selectedScriptData } = useSWR<PaginatedResult<LuaScriptRow>>(
    scriptId ? `/api/admin/lua-scripts?search=${scriptId}&pageSize=5` : null,
    fetcher,
  );
  const selectedScript = selectedScriptData?.data.find((row) => row.id === scriptId) ?? null;

  const previewNpc = { ...defaultValues, ...watched } as NpcInput;
  const previewXml = buildNpcXml(previewNpc, selectedLooktype?.looktypeNumber ?? null, selectedScript?.name ?? null);
  const previewScriptContent = resolveScriptContent(previewNpc, selectedScript?.content ?? null);

  async function handleSubmit(values: NpcInput) {
    const response = await fetch(npcId ? `/api/admin/npcs/${npcId}` : "/api/admin/npcs", {
      method: npcId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      toast.error("Não foi possível salvar o NPC.");
      return;
    }

    const data = await response.json();
    if (data.warning) toast.warning(data.warning);
    else toast.success("NPC salvo com sucesso.");

    router.push("/admin/npcs");
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-6">
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
                    onChange={(event) => field.onChange(event.target.checked)}
                  />
                </FormControl>
                <FormLabel className="font-normal">Publicado</FormLabel>
              </FormItem>
            )}
          />

          <Tabs defaultValue="identification">
            <TabsList>
              <TabsTrigger value="identification">Identificador</TabsTrigger>
              <TabsTrigger value="messages">Mensagens</TabsTrigger>
              {type === "shop" && <TabsTrigger value="items">Items</TabsTrigger>}
            </TabsList>

            <TabsContent value="identification" className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Identificação</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
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

                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        Script Lua
                        {type === "shop" && (
                          <FieldTooltip text="Ao vincular um script customizado a um NPC de Loja, seu script substitui o default.lua — inclua NpcSystem.parseParameters(npcHandler) e o módulo de loja (ShopModule) para manter compra/venda funcionando." />
                        )}
                      </FormLabel>
                      <ScriptLuaField value={watched.scriptId ?? null} onChange={(id) => form.setValue("scriptId", id)} />
                    </FormItem>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1.5">
                            Tipo
                            <FieldTooltip text="Shop: interface de loja nativa, sem script customizado. Quest/Outro: usa o Script Lua acima." />
                          </FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Selecione o tipo" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {NPC_TYPES.map((t) => (
                                <SelectItem key={t} value={t}>
                                  {NPC_TYPE_LABELS[t]}
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
                      name="walkinterval"
                      label="Intervalo de passos (ms)"
                      tooltip="Intervalo (ms) entre passos aleatórios do NPC parado — 2000 é o padrão do Tibia."
                      min={0}
                    />
                  </div>

                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <EntitySearchCombobox<NpcCategoryRow>
                      endpoint="/api/admin/npc-categories"
                      value={watched.categoryId ?? null}
                      placeholder="Buscar categoria..."
                      formatOption={(cat) => cat.name}
                      renderOption={(cat) => (
                        <Badge
                          style={{
                            backgroundColor: cat.color,
                            color: textColorFor(cat.color),
                            borderColor: cat.color,
                          }}
                        >
                          {cat.name}
                        </Badge>
                      )}
                      onSelect={(cat) => form.setValue("categoryId", cat?.id ?? null)}
                    />
                  </FormItem>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Aparência (Outfit)</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <FormItem>
                    <FormLabel>Looktype (sprite)</FormLabel>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <EntitySearchCombobox<LooktypeRow>
                          endpoint="/api/admin/looktypes?category=outfit"
                          value={lookTypeId || null}
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
                          onSelect={(lt) => form.setValue("lookTypeId", lt?.id ?? 0)}
                        />
                      </div>
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-md border border-border bg-muted/20">
                        {selectedLooktype ? (
                          <OutfitColorPreview
                            key={selectedLooktype.id}
                            looktypeId={selectedLooktype.id}
                            frameCount={selectedLooktype.frameCount}
                            frameDurationsMs={selectedLooktype.frameDurationsMs}
                            updatedAt={selectedLooktype.updatedAt}
                            directions={selectedLooktype.directions}
                            hasColorMask={selectedLooktype.hasColorMask}
                            addonSlots={selectedLooktype.addonSlots}
                            direction={watched.direction ?? 2}
                            addons={watched.lookAddons ?? 0}
                            headColor={watched.lookHead ?? 0}
                            bodyColor={watched.lookBody ?? 0}
                            legsColor={watched.lookLegs ?? 0}
                            feetColor={watched.lookFeet ?? 0}
                            size="sm"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </div>
                  </FormItem>

                  <OptionRadioField
                    control={form.control}
                    name="direction"
                    label="Direção"
                    tooltip="Direção que o NPC olha ao spawnar."
                    orientation="horizontal"
                    options={[
                      { value: 0, label: "Norte" },
                      { value: 1, label: "Leste" },
                      { value: 2, label: "Sul" },
                      { value: 3, label: "Oeste" },
                    ]}
                  />

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <TibiaColorPickerField
                      control={form.control}
                      name="lookHead"
                      label="Cabeça (Head)"
                      tooltip="Cabeça (Head): tinge o cabelo/capacete — cor 'Cabeça' no diálogo de outfit do cliente Tibia."
                    />
                    <TibiaColorPickerField
                      control={form.control}
                      name="lookBody"
                      label="Corpo (Body)"
                      tooltip="Corpo (Body): tinge o torso da sprite — cor 'Primária' no diálogo de outfit do cliente Tibia."
                    />
                    <TibiaColorPickerField
                      control={form.control}
                      name="lookLegs"
                      label="Pernas (Legs)"
                      tooltip="Pernas (Legs): tinge as pernas da sprite — cor 'Secundária' no diálogo de outfit do cliente Tibia."
                    />
                    <TibiaColorPickerField
                      control={form.control}
                      name="lookFeet"
                      label="Pés (Feet)"
                      tooltip="Pés (Feet): tinge os pés/calçado da sprite — cor 'Detalhe' no diálogo de outfit do cliente Tibia."
                    />
                  </div>

                  <OptionRadioField
                    control={form.control}
                    name="lookAddons"
                    label="Addons"
                    tooltip="Addons desbloqueados no outfit — não é uma cor, é uma combinação (bitmask) das 2 peças de addon."
                    orientation="horizontal"
                    options={[
                      { value: 0, label: "Nenhum" },
                      { value: 1, label: "Addon 1" },
                      { value: 2, label: "Addon 2" },
                      { value: 3, label: "Ambos" },
                    ]}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Posição</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      Cidade
                      <FieldTooltip text="Cidade (town) associada ao spawn do NPC — usado para agrupar NPCs por região no cliente/servidor, não afeta a posição real." />
                    </FormLabel>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <EntitySearchCombobox<TownRow>
                          endpoint="/api/admin/towns"
                          value={null}
                          placeholder={watched.town || "Buscar cidade..."}
                          formatOption={(town) => town.name}
                          onSelect={(town) => form.setValue("town", town?.name ?? "")}
                        />
                      </div>
                      {Boolean(watched.town) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          title="Limpar cidade"
                          onClick={() => form.setValue("town", "")}
                        >
                          <X className="size-4" />
                        </Button>
                      )}
                    </div>
                  </FormItem>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <NumberField
                      control={form.control}
                      name="posX"
                      label="Posição X"
                      tooltip="Coordenada X do tile onde o NPC nasce no mapa (mesmo sistema de coordenadas do mapa OTBM)."
                    />
                    <NumberField
                      control={form.control}
                      name="posY"
                      label="Posição Y"
                      tooltip="Coordenada Y do tile onde o NPC nasce no mapa."
                    />
                    <NumberField
                      control={form.control}
                      name="posZ"
                      label="Posição Z"
                      tooltip="Andar/piso (floor) onde o NPC nasce — 7 é o nível do solo padrão; valores menores são andares superiores, maiores são subterrâneos."
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="messages" className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Mensagens padrão</CardTitle>
                </CardHeader>
                <CardContent>
                  <NpcDefaultMessageFields
                    control={form.control}
                    name="defaultMessages"
                    onChange={(key, value) =>
                      form.setValue("defaultMessages", { ...form.getValues("defaultMessages"), [key]: value })
                    }
                  />
                </CardContent>
              </Card>

              {type !== "shop" && !watched.scriptId && (
                <Card>
                  <CardHeader>
                    <CardTitle>Falas ambiente</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    <p className="text-sm text-muted-foreground">
                      Mensagens que o NPC diz espontaneamente (independente de conversa), igual aos
                      NPCs do Tibia Global — cada uma com seu próprio intervalo e chance.
                    </p>
                    <NpcCustomMessageListField control={form.control} name="customMessages" />
                  </CardContent>
                </Card>
              )}

              {type === "shop" && (
                <p className="text-sm text-muted-foreground">
                  NPCs do tipo Loja usam a interface de loja nativa por padrão — falas ambiente não
                  se aplicam a esse tipo, mas um script Lua pode ser vinculado na aba Identificador
                  se desejado.
                </p>
              )}
            </TabsContent>

            {type === "shop" && (
              <TabsContent value="items">
                <NpcShopItemListField control={form.control} name="shopItems" />
              </TabsContent>
            )}
          </Tabs>

          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" nativeButton={false} render={<Link href="/admin/npcs" />}>
              Cancelar
            </Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </Form>

      <div className="flex flex-col gap-6 lg:sticky lg:top-6">
        <XmlPreviewCard value={previewXml} />

        {needsOwnScript(previewNpc) && (
          <div className="flex flex-col gap-2">
            {scriptId && (
              <p className="text-sm text-muted-foreground">
                Conteúdo do script vinculado ({selectedScript?.name ?? "carregando..."}) — as
                Mensagens padrão gerais não têm efeito aqui; inclua suas próprias chamadas{" "}
                <code>npcHandler:setMessage(...)</code> diretamente no script se precisar delas.
              </p>
            )}
            <LuaScriptPreviewCard value={previewScriptContent} />
          </div>
        )}

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Sprite vinculada</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            {selectedLooktype ? (
              <OutfitColorPreview
                key={selectedLooktype.id}
                looktypeId={selectedLooktype.id}
                frameCount={selectedLooktype.frameCount}
                frameDurationsMs={selectedLooktype.frameDurationsMs}
                updatedAt={selectedLooktype.updatedAt}
                directions={selectedLooktype.directions}
                hasColorMask={selectedLooktype.hasColorMask}
                addonSlots={selectedLooktype.addonSlots}
                direction={watched.direction ?? 2}
                addons={watched.lookAddons ?? 0}
                headColor={watched.lookHead ?? 0}
                bodyColor={watched.lookBody ?? 0}
                legsColor={watched.lookLegs ?? 0}
                feetColor={watched.lookFeet ?? 0}
                size="lg"
              />
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma sprite vinculada.</p>
            )}
          </CardContent>
        </Card>

        {type === "shop" &&
          (() => {
            const uniqueShopItems = Array.from(
              (watched.shopItems ?? [])
                .filter((item): item is NpcShopItemInput => Boolean(item?.itemId && item.itemId > 0))
                .reduce((map, item) => {
                  if (!map.has(item.itemId as number)) {
                    map.set(item.itemId as number, item);
                  }
                  return map;
                }, new Map<number, NpcShopItemInput>())
                .values(),
            );

            return (
              <CollapsibleSectionCard
                title="Items/recompensas"
                defaultOpen={false}
                className="h-fit"
              >
                {uniqueShopItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum item de compra/venda ainda.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {uniqueShopItems.map((item) => (
                      <EntityThumb
                        key={item.itemId}
                        entityType="item"
                        id={item.itemId as number}
                        name={item.name}
                        size="32"
                      />
                    ))}
                  </div>
                )}
              </CollapsibleSectionCard>
            );
          })()}
      </div>
    </div>
  );
}

function ScriptLuaField({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const { data } = useSWR<PaginatedResult<LuaScriptRow>>(
    value ? `/api/admin/lua-scripts?search=${value}&pageSize=5` : null,
    fetcher,
  );
  const resolved = data?.data.find((row) => row.id === value) ?? null;

  return (
    <EntitySearchCombobox<LuaScriptRow>
      endpoint="/api/admin/lua-scripts?category=npc"
      value={value}
      placeholder={resolved?.name ?? "Buscar script Lua..."}
      formatOption={(script) => script.name}
      onSelect={(script) => onChange(script?.id ?? null)}
    />
  );
}
