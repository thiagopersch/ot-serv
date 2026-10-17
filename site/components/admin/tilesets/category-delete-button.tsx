"use client";

import { useState } from "react";
import useSWR from "swr";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import { Button } from "@/components/ui/button";
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
import type { CategoryRow } from "@/components/admin/tilesets/category-item";

type CategoryOption = { id: number; label: string; tilesetId: number };

type CategoryDeleteButtonProps = {
  category: CategoryRow;
  onDeleted: () => void;
};

export function CategoryDeleteButton({ category, onDeleted }: CategoryDeleteButtonProps) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const linkedCount =
    category._count.grounds + category._count.walls + category._count.doodads + category._count.itemEntries;
  const needsTarget = linkedCount > 0;

  const { data } = useSWR<{ categories: CategoryOption[] }>(
    needsTarget && open ? `/api/admin/tilesets/categories?type=${category.type}` : null,
    fetcher
  );

  const options = (data?.categories ?? []).filter((c) => c.id !== category.id);

  async function handleDelete() {
    if (needsTarget && target == null) {
      toast.error("Selecione uma categoria de destino para mover os brushes/itens.");
      return;
    }

    setIsSubmitting(true);
    const url = needsTarget
      ? `/api/admin/tilesets/categories/${category.id}?moveEntriesTo=${target}`
      : `/api/admin/tilesets/categories/${category.id}`;

    const response = await fetch(url, { method: "DELETE" });
    setIsSubmitting(false);
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(body?.error ?? "Não foi possível remover a categoria.");
      return;
    }

    toast.success("Categoria removida.");
    setOpen(false);
    onDeleted();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="destructive" size="icon-sm" title="Excluir categoria">
            <Trash2 className="size-4" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remover categoria &quot;{category.name}&quot;</DialogTitle>
          <DialogDescription>
            {needsTarget
              ? `Esta categoria tem ${linkedCount} brush(es)/item(ns) vinculado(s). Escolha para onde mover antes de excluir.`
              : "Esta ação não pode ser desfeita."}
          </DialogDescription>
        </DialogHeader>

        {needsTarget && (
          <Select value={target != null ? String(target) : undefined} onValueChange={(v) => setTarget(v ? Number(v) : null)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Categoria de destino...">
                {(value: string) => options.find((option) => String(option.id) === value)?.label ?? value}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.id} value={String(option.id)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <DialogFooter>
          <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
            {isSubmitting ? "Removendo..." : "Remover"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
