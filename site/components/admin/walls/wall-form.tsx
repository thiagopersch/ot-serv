"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import {
  WALL_FILE_BRUSH_TYPES,
  defaultWallValues,
  resolveContentMode,
  wallFormSchema,
  type WallFormInput,
} from "@/lib/validations/admin/wall";
import { wallBrushToXml } from "@/lib/wall-xml";
import { wallFormItemIds } from "@/lib/brush-item-ids";
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
import { WallSegmentListField } from "@/components/admin/walls/wall-segment-list-field";
import { FriendListField } from "@/components/admin/walls/friend-list-field";
import { TilesetCategoryField } from "@/components/shared/tileset-category-field";
import { XmlPreviewCard } from "@/components/shared/xml-preview-card";
import { EntitySpritePreview, type SpritePreviewEntry } from "@/components/shared/entity-sprite-preview";

type WallFormProps = {
  brushId?: number;
  initialValues?: WallFormInput;
};

const TYPE_LABELS: Record<WallFormInput["type"], string> = {
  wall: "Wall (segue traçado de parede)",
  "wall decoration": "Wall decoration (decoração de parede)",
  doodad: "Doodad (arco/decoração multi-tile)",
};

export function WallForm({ brushId, initialValues }: WallFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = brushId != null;

  const form = useForm<WallFormInput, unknown, WallFormInput>({
    resolver: zodResolver(wallFormSchema),
    defaultValues: initialValues ?? defaultWallValues,
  });

  const watched = useWatch({ control: form.control });
  const previewXml = wallBrushToXml({ ...defaultWallValues, ...watched } as WallFormInput);

  const spritePreviewItems: SpritePreviewEntry[] = [
    ...(watched.serverLookId ? [{ id: watched.serverLookId, label: "Preview" }] : []),
    ...wallFormItemIds(watched as WallFormInput)
      .filter((id) => id !== watched.serverLookId)
      .map((id) => ({ id, label: `#${id}` })),
  ];

  const [contentMode, setContentMode] = useState<"wall" | "doodad">(() =>
    resolveContentMode(initialValues ?? defaultWallValues)
  );

  async function onSubmit(values: WallFormInput) {
    setIsSubmitting(true);

    // Garante que só o conteúdo do modo selecionado na aba "Conteúdo" seja salvo,
    // mesmo que o outro lado tenha sobrado dados de uma edição anterior.
    const payload: WallFormInput =
      contentMode === "wall"
        ? { ...values, items: [], composites: [], alternates: [] }
        : { ...values, walls: [] };

    const url = isEditing ? `/api/admin/walls/${brushId}` : "/api/admin/walls";
    const method = isEditing ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      toast.error(data?.error ?? "Não foi possível salvar a wall.");
      return;
    }

    toast.success(isEditing ? "Wall atualizada." : "Wall criada.");
    router.push("/admin/walls");
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
              <TabsTrigger value="friends">Friends</TabsTrigger>
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
                            {WALL_FILE_BRUSH_TYPES.map((type) => (
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
                        <FormLabel>Thickness (ex.: 100/100)</FormLabel>
                        <FormControl>
                          <Input placeholder="N/100" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <TilesetCategoryField control={form.control} name="tilesetCategoryId" brushKind="terrain" />

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
                  <CardTitle>Conteúdo</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    O formato do conteúdo é independente do <code>type</code> do brush — no
                    arquivo real, brushes <code>type=&quot;wall&quot;</code> às vezes usam
                    itens/alternates soltos em vez de <code>&lt;wall type=&quot;...&quot;&gt;</code>.
                    Escolha manualmente qual editar:
                  </p>
                  <div className="flex gap-2 pt-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={contentMode === "wall" ? "default" : "outline"}
                      onClick={() => setContentMode("wall")}
                    >
                      Segmentos de parede (wall/door)
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={contentMode === "doodad" ? "default" : "outline"}
                      onClick={() => setContentMode("doodad")}
                    >
                      Itens/Composites/Alternates
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-6">
                  {contentMode === "wall" ? (
                    <WallSegmentListField control={form.control} name="walls" />
                  ) : (
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
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="friends">
              <Card>
                <CardHeader>
                  <CardTitle>Friends</CardTitle>
                </CardHeader>
                <CardContent>
                  <FriendListField control={form.control} name="friends" />
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
              render={<Link href="/admin/walls" />}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
              {isSubmitting ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar wall"}
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
