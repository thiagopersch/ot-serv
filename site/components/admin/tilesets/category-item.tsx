"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CopyPlus, GripVertical, Pencil } from "lucide-react";
import { toast } from "sonner";

import type { TilesetCategoryFormInput } from "@/lib/validations/admin/tileset";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CategoryFormDialog } from "@/components/admin/tilesets/category-form-dialog";
import { CategoryDeleteButton } from "@/components/admin/tilesets/category-delete-button";

export type CategoryRow = TilesetCategoryFormInput & {
  id: number;
  _count: { grounds: number; walls: number; doodads: number; itemEntries: number };
};

const KIND_LABELS: Record<string, string> = {
  TERRAIN: "Terrain",
  TERRAIN_AND_RAW: "Terrain + Raw",
  DOODAD: "Doodad",
  DOODAD_AND_RAW: "Doodad + Raw",
  RAW: "Raw",
  ITEMS: "Items",
  ITEMS_AND_RAW: "Items + Raw",
};

type CategoryItemProps = {
  category: CategoryRow;
  tilesetId: number;
  onSaved: () => void;
  onOpenDetail: () => void;
};

export function CategoryItem({ category, tilesetId, onSaved, onOpenDetail }: CategoryItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  });

  async function handleDuplicate() {
    const response = await fetch(`/api/admin/tilesets/categories/${category.id}/duplicate`, { method: "POST" });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(body?.error ?? "Não foi possível duplicar a categoria.");
      return;
    }

    toast.success(`Categoria duplicada como "${body.category.name}".`);
    onSaved();
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const entryCount =
    category.type === "BRUSH"
      ? category._count.grounds + category._count.walls + category._count.doodads + category._count.itemEntries
      : category._count.itemEntries;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border bg-card p-3"
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      <div className="flex min-w-0 flex-1 flex-col">
        <button type="button" onClick={onOpenDetail} className="truncate text-left font-medium hover:underline">
          {category.name}
        </button>
        <span className="text-xs text-muted-foreground">
          {entryCount} {category.type === "BRUSH" ? "brush(es)" : "item(ns)"}
        </span>
      </div>

      <Badge variant="outline">{KIND_LABELS[category.kind] ?? category.kind}</Badge>
      <Badge variant={category.type === "BRUSH" ? "default" : "secondary"}>{category.type}</Badge>

      <CategoryFormDialog
        tilesetId={tilesetId}
        category={category}
        onSaved={onSaved}
        trigger={
          <Button variant="ghost" size="icon-sm" title="Editar categoria">
            <Pencil className="size-4" />
          </Button>
        }
      />

      <Button variant="ghost" size="icon-sm" title="Duplicar categoria" onClick={handleDuplicate}>
        <CopyPlus className="size-4" />
      </Button>

      <CategoryDeleteButton category={category} onDeleted={onSaved} />
    </div>
  );
}
