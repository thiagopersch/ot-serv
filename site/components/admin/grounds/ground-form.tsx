"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import useSWR from "swr";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import { defaultGroundValues, groundFormSchema, type GroundFormInput } from "@/lib/validations/admin/ground";
import { groundToXml } from "@/lib/ground-xml";
import { BORDER_EDGES, type BorderEdge, type BorderEdgeItemInput } from "@/lib/validations/admin/border";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { NumberField } from "@/components/shared/number-field";
import { ItemsListField } from "@/components/shared/items-list-field";
import { ItemSearchField } from "@/components/shared/item-search-field";
import { TilesetCategoryField } from "@/components/shared/tileset-category-field";
import { XmlPreviewCard } from "@/components/shared/xml-preview-card";
import { BorderRingPreview } from "@/components/shared/border-ring-preview";
import { EntitySpritePreview, type SpritePreviewEntry } from "@/components/shared/entity-sprite-preview";
import { GroundBorderListField } from "@/components/admin/grounds/ground-border-list-field";
import { GroundFriendListField } from "@/components/admin/grounds/ground-friend-list-field";
import type { BorderOption } from "@/components/admin/grounds/ground-border-combobox";

type GroundFormProps = {
  groundId?: number;
  initialValues?: GroundFormInput;
};

type BorderListItem = { id: number; name: string; group: number | null; edges?: BorderEdgeItemInput[] };

const OUTER_EDGES = new Set<BorderEdge>(BORDER_EDGES.slice(0, 8));
const INNER_EDGES = new Set<BorderEdge>(BORDER_EDGES.slice(8));

export function GroundForm({ groundId, initialValues }: GroundFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = groundId != null;

  const { data: bordersData } = useSWR<PaginatedResult<BorderListItem>>(
    "/api/admin/borders?all=true",
    fetcher
  );

  const borderOptions: BorderOption[] =
    bordersData?.data.map((border) => ({
      value: border.id,
      label: `#${border.id} — ${border.name}`,
    })) ?? [];

  const bordersById = new Map((bordersData?.data ?? []).map((border) => [border.id, border.edges ?? []]));

  const form = useForm<GroundFormInput, unknown, GroundFormInput>({
    resolver: zodResolver(groundFormSchema),
    defaultValues: initialValues ?? defaultGroundValues,
  });

  const watched = useWatch({ control: form.control });
  const previewXml = groundToXml({ ...defaultGroundValues, ...watched } as GroundFormInput);

  const outerBorderRef = (watched.borders ?? []).find((b) => b?.align === "outer");
  const innerBorderRef = (watched.borders ?? []).find((b) => b?.align === "inner");
  const outerBorder = bordersData?.data.find((b) => b.id === outerBorderRef?.borderId);
  const innerBorder = bordersData?.data.find((b) => b.id === innerBorderRef?.borderId);

  const edgeMap: Partial<Record<BorderEdge, number>> = {};
  for (const entry of outerBorder?.edges ?? []) {
    if (OUTER_EDGES.has(entry.edge) && entry.itemId > 0) edgeMap[entry.edge] = entry.itemId;
  }
  for (const entry of (innerBorder ?? outerBorder)?.edges ?? []) {
    if (INNER_EDGES.has(entry.edge) && entry.itemId > 0) edgeMap[entry.edge] = entry.itemId;
  }

  const groundItemPreview: SpritePreviewEntry[] = (watched.items ?? [])
    .filter((item): item is { id: number; chance: number | null } => Boolean(item?.id) && item.id !== watched.serverLookId)
    .map((item) => ({ id: item.id, label: `#${item.id}` }));

  async function onSubmit(values: GroundFormInput) {
    setIsSubmitting(true);

    const url = isEditing ? `/api/admin/grounds/${groundId}` : "/api/admin/grounds";
    const method = isEditing ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      toast.error(data?.error ?? "Não foi possível salvar o ground.");
      return;
    }

    toast.success(isEditing ? "Ground atualizado." : "Ground criado.");
    router.push("/admin/grounds");
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

                  <ItemSearchField
                    control={form.control}
                    name="serverLookId"
                    label="Item de preview (server_lookid)"
                  />

                  <TilesetCategoryField control={form.control} name="tilesetCategoryId" brushKind="terrain" />

                  <NumberField control={form.control} name="zOrder" label="Ordem de sobreposição (z-order)" />

                  <FormField
                    control={form.control}
                    name="soloOptional"
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
                        <FormLabel className="!mt-0">Solo optional</FormLabel>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="content">
              <Card>
                <CardHeader>
                  <CardTitle>Conteúdo</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-6">
                  <div>
                    <span className="mb-2 block text-sm font-medium">Itens do chão</span>
                    <ItemsListField control={form.control} name="items" />
                  </div>
                  <GroundBorderListField
                    control={form.control}
                    borderOptions={borderOptions}
                    bordersById={bordersById}
                  />
                  <GroundFriendListField control={form.control} />
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
              render={<Link href="/admin/grounds" />}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
              {isSubmitting ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar ground"}
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
          <CardContent className="flex flex-col gap-4">
            <BorderRingPreview
              center={watched.serverLookId ? { id: watched.serverLookId, label: "Ground" } : null}
              edges={edgeMap}
            />
            {groundItemPreview.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Variações do chão</p>
                <EntitySpritePreview items={groundItemPreview} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
