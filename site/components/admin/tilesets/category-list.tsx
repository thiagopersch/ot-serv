"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { toast } from "sonner";

import { CategoryItem, type CategoryRow } from "@/components/admin/tilesets/category-item";
import { CategoryDetailDialog } from "@/components/admin/tilesets/category-detail-dialog";

type CategoryListProps = {
  tilesetId: number;
  categories: CategoryRow[];
  onChanged: () => void;
};

export function CategoryList({ tilesetId, categories, onChanged }: CategoryListProps) {
  const [detailCategory, setDetailCategory] = useState<CategoryRow | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(categories, oldIndex, newIndex);
    onChanged(); // otimista: revalida a lista assim que a API confirmar abaixo

    const response = await fetch("/api/admin/tilesets/categories/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: reordered.map((c, index) => ({ id: c.id, order: index })) }),
    });

    if (!response.ok) {
      toast.error("Não foi possível salvar a nova ordem.");
    }
    onChanged();
  }

  if (categories.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Nenhuma categoria ainda. Crie a primeira acima.
      </p>
    );
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {categories.map((category) => (
              <CategoryItem
                key={category.id}
                category={category}
                tilesetId={tilesetId}
                onSaved={onChanged}
                onOpenDetail={() => setDetailCategory(category)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {detailCategory && (
        <CategoryDetailDialog
          category={detailCategory}
          open={detailCategory != null}
          onOpenChange={(open) => !open && setDetailCategory(null)}
          onChanged={onChanged}
        />
      )}
    </>
  );
}
