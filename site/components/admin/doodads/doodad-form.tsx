"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import {
  DOODAD_BRUSH_TYPES,
  defaultDoodadValues,
  doodadFormSchema,
  isWallBrushType,
  type DoodadFormInput,
} from "@/lib/validations/admin/doodad";
import { doodadToXml } from "@/lib/doodad-xml";
import { doodadFormItemIds } from "@/lib/brush-item-ids";
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
import { ItemSearchField } from "@/components/shared/item-search-field";
import { ItemsListField } from "@/components/shared/items-list-field";
import { CompositeListField } from "@/components/shared/composite-list-field";
import { AlternateListField } from "@/components/shared/alternate-list-field";
import { CarpetGridField } from "@/components/admin/doodads/carpet-grid-field";
import { WallSegmentListField } from "@/components/admin/doodads/wall-segment-list-field";
import { TableSegmentListField } from "@/components/admin/doodads/table-segment-list-field";
import { TilesetCategoryField } from "@/components/shared/tileset-category-field";
import { XmlPreviewCard } from "@/components/shared/xml-preview-card";
import { EntitySpritePreview, type SpritePreviewEntry } from "@/components/shared/entity-sprite-preview";

type DoodadFormProps = {
  brushId?: number;
  initialValues?: DoodadFormInput;
};

const TYPE_LABELS: Record<DoodadFormInput["type"], string> = {
  doodad: "Doodad (decoração genérica)",
  carpet: "Carpet (tapete com auto-borda)",
  wall: "Wall (segue traçado de parede)",
  "wall decoration": "Wall decoration (decoração de parede)",
  table: "Table (mesa/objeto linear)",
};

export function DoodadForm({ brushId, initialValues }: DoodadFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = brushId != null;

  const form = useForm<DoodadFormInput, unknown, DoodadFormInput>({
    resolver: zodResolver(doodadFormSchema),
    defaultValues: initialValues ?? defaultDoodadValues,
  });

  const watched = useWatch({ control: form.control });
  const previewXml = doodadToXml({ ...defaultDoodadValues, ...watched } as DoodadFormInput);
  const currentType = watched.type ?? "doodad";

  const spritePreviewItems: SpritePreviewEntry[] = [
    ...(watched.serverLookId ? [{ id: watched.serverLookId, label: "Preview" }] : []),
    ...doodadFormItemIds(watched as DoodadFormInput)
      .filter((id) => id !== watched.serverLookId)
      .map((id) => ({ id, label: `#${id}` })),
  ];

  async function onSubmit(values: DoodadFormInput) {
    setIsSubmitting(true);

    const url = isEditing ? `/api/admin/doodads/${brushId}` : "/api/admin/doodads";
    const method = isEditing ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      toast.error(data?.error ?? "Não foi possível salvar o doodad.");
      return;
    }

    toast.success(isEditing ? "Doodad atualizado." : "Doodad criado.");
    router.push("/admin/doodads");
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
          <Tabs defaultValue="basic">
            <TabsList>
              <TabsTrigger value="basic">Dados básicos</TabsTrigger>
              <TabsTrigger value="content">Conteúdo</TabsTrigger>
            </TabsList>

            <TabsContent value="basic">
              <Card>
                <CardHeader>
                  <CardTitle>Dados básicos</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
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
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {DOODAD_BRUSH_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {TYPE_LABELS[type]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <ItemSearchField control={form.control} name="serverLookId" label="Item de preview (server_lookid)" />

                  <FormField
                    control={form.control}
                    name="thickness"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Thickness (ex.: 12/100)</FormLabel>
                        <FormControl>
                          <Input placeholder="N/100" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <TilesetCategoryField control={form.control} name="tilesetCategoryId" brushKind="doodad" />

                  <div className="flex flex-wrap gap-x-6 gap-y-2 sm:col-span-2">
                    {(
                      [
                        ["draggable", "Draggable (pintar arrastando)"],
                        ["onBlocking", "On blocking (permite sobre tile bloqueado)"],
                        ["onDuplicate", "On duplicate (auto-preenchimento)"],
                        ["oneSize", "One size (tamanho único)"],
                        ["redoBorders", "Redo borders (recalcula bordas)"],
                        ["reborder", "Reborder (refaz bordas ao redor)"],
                      ] as const
                    ).map(([name, label]) => (
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
                                onChange={(event) => field.onChange(event.target.checked)}
                              />
                            </FormControl>
                            <FormLabel className="!mt-0">{label}</FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="content">
              <Card>
                <CardHeader>
                  <CardTitle>Conteúdo — {TYPE_LABELS[currentType]}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-6">
                  {currentType === "doodad" && (
                    <>
                      <div>
                        <span className="mb-2 block text-sm font-medium">
                          Itens diretos (variação simples de 1 tile)
                        </span>
                        <ItemsListField control={form.control} name="items" />
                      </div>
                      <CompositeListField control={form.control} name="composites" />
                      <AlternateListField control={form.control} name="alternates" />
                    </>
                  )}

                  {currentType === "carpet" && <CarpetGridField control={form.control} />}

                  {isWallBrushType(currentType) && (
                    <WallSegmentListField control={form.control} name="walls" />
                  )}

                  {currentType === "table" && (
                    <TableSegmentListField control={form.control} name="tables" />
                  )}
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
              render={<Link href="/admin/doodads" />}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
              {isSubmitting ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar doodad"}
            </Button>
          </div>
        </form>
      </Form>

      <div className="flex flex-col gap-6 lg:sticky lg:top-6">
        <XmlPreviewCard value={previewXml} />

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Pré-visualização das sprites</CardTitle>
          </CardHeader>
          <CardContent>
            <EntitySpritePreview items={spritePreviewItems} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
