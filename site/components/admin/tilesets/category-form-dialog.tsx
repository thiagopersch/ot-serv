"use client";

import { useEffect, useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import useSWR from "swr";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import {
  categoryTypeForKind,
  TILESET_CATEGORY_KINDS,
  tilesetCategoryFormSchema,
  type TilesetCategoryFormInput,
  type TilesetCategoryKind,
} from "@/lib/validations/admin/tileset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

const KIND_LABELS: Record<TilesetCategoryKind, string> = {
  TERRAIN: "Brush — Terrain (Ground/Wall)",
  DOODAD: "Brush — Doodad",
  RAW: "Item (IDs e intervalos)",
  TERRAIN_AND_RAW: "Brush — Terrain + Item (misturados na mesma tag)",
  DOODAD_AND_RAW: "Brush — Doodad + Item (misturados na mesma tag)",
  ITEMS: "Item — items",
  ITEMS_AND_RAW: "Item — items + raw",
};

type CategoryFormDialogProps = {
  tilesetId: number;
  trigger: ReactNode;
  category?: TilesetCategoryFormInput & { id: number };
  nextOrder?: number;
  onSaved: () => void;
};

export function CategoryFormDialog({ tilesetId, trigger, category, nextOrder = 0, onSaved }: CategoryFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = category != null;

  const form = useForm<TilesetCategoryFormInput, unknown, TilesetCategoryFormInput>({
    resolver: zodResolver(tilesetCategoryFormSchema),
    defaultValues: category ?? {
      tilesetId,
      name: "",
      kind: "TERRAIN",
      type: "BRUSH",
      order: nextOrder,
      description: null,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        category ?? { tilesetId, name: "", kind: "TERRAIN", type: "BRUSH", order: nextOrder, description: null }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const { data: tilesetsData } = useSWR<PaginatedResult<{ id: number; name: string }>>(
    isEditing && open ? "/api/admin/tilesets?pageSize=200" : null,
    fetcher
  );
  const tilesetOptions = tilesetsData?.data ?? [];

  const kindOptions: TilesetCategoryKind[] = [...TILESET_CATEGORY_KINDS];

  async function onSubmit(values: TilesetCategoryFormInput) {
    setIsSubmitting(true);

    const payload = { ...values, type: categoryTypeForKind(values.kind) };
    const url = isEditing
      ? `/api/admin/tilesets/categories/${category.id}`
      : `/api/admin/tilesets/${tilesetId}/categories`;
    const method = isEditing ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setIsSubmitting(false);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(data?.error ?? "Não foi possível salvar a categoria.");
      return;
    }

    toast.success(isEditing ? "Categoria atualizada." : "Categoria criada.");
    setOpen(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar categoria" : "Nova categoria"}</DialogTitle>
          <DialogDescription>
            Categorias do tipo Brush viram tags <code>terrain</code>/<code>doodad</code> no
            tilesets.xml; categorias do tipo Item viram <code>raw</code>.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
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

            {isEditing && (
              <FormField
                control={form.control}
                name="tilesetId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tileset</FormLabel>
                    <Select value={String(field.value)} onValueChange={(v) => v && field.onChange(Number(v))}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(value: string) =>
                              tilesetOptions.find((tileset) => String(tileset.id) === value)?.name ?? value
                            }
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {tilesetOptions.map((tileset) => (
                          <SelectItem key={tileset.id} value={String(tileset.id)}>
                            {tileset.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="kind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value: TilesetCategoryKind | null) => {
                      if (!value) return;
                      field.onChange(value);
                      // `type` não tem campo próprio no form (é 1:1 derivado de `kind`), mas o
                      // schema exige os dois em sincronia (`refine`) — sem isto, trocar o kind
                      // deixa `type` com o valor antigo e o submit falha em silêncio (nenhum
                      // FormField/FormMessage pro campo "type" pra mostrar o erro).
                      form.setValue("type", categoryTypeForKind(value), { shouldValidate: true });
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(value: TilesetCategoryKind) => KIND_LABELS[value] ?? value}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {kindOptions.map((kind) => (
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição (opcional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value || null)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar categoria"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
