"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ExternalLink, GripVertical } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";

type BrushType = "ground" | "wall" | "doodad";
type BrushRef = { id: number; name: string; tilesetOrder: number };
type CombinedBrush = { type: BrushType; id: number; name: string };

const TYPE_LABELS: Record<BrushType, string> = {
  ground: "Ground",
  wall: "Wall",
  doodad: "Doodad",
};

const TYPE_HREF: Record<BrushType, (id: number) => string> = {
  ground: (id) => `/admin/grounds/${id}`,
  wall: (id) => `/admin/walls/${id}`,
  doodad: (id) => `/admin/doodads/${id}`,
};

/** Junta os 3 tipos de brush numa única lista ordenada por `tilesetOrder` — com o
 * mesmo desempate (ground, wall, doodad) usado em `tilesetCategoryToXmlCategory` ao
 * concatenar os arrays, para o que aparece aqui bater com o que sai no XML. */
function mergeBrushes(grounds: BrushRef[], walls: BrushRef[], doodads: BrushRef[]): CombinedBrush[] {
  const tagged = [
    ...grounds.map((b) => ({ type: "ground" as const, ...b, typeRank: 0 })),
    ...walls.map((b) => ({ type: "wall" as const, ...b, typeRank: 1 })),
    ...doodads.map((b) => ({ type: "doodad" as const, ...b, typeRank: 2 })),
  ];

  return tagged
    .sort((a, b) => a.tilesetOrder - b.tilesetOrder || a.typeRank - b.typeRank)
    .map(({ type, id, name }) => ({ type, id, name }));
}

/** Tile compacto (não uma linha inteira) — a lista inteira flui horizontalmente, tantos
 * tiles quanto couberem por linha, indo para a linha de baixo quando não couber mais
 * (como uma grade numerada 1..N), em vez de uma coluna vertical única. */
function SortableBrushTile({ brush, index }: { brush: CombinedBrush; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `${brush.type}-${brush.id}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex w-40 shrink-0 flex-col gap-1 rounded-md border bg-card p-2"
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
        <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
        <Badge variant="outline" className="ml-auto shrink-0 text-[10px]">
          {TYPE_LABELS[brush.type]}
        </Badge>
      </div>
      <Link
        href={TYPE_HREF[brush.type](brush.id)}
        className="flex min-w-0 items-center gap-1 truncate text-xs text-primary hover:underline"
      >
        <span className="truncate">{brush.name}</span>
        <ExternalLink className="size-3 shrink-0" />
      </Link>
    </li>
  );
}

type CategoryBrushOrderListProps = {
  categoryId: number;
  grounds: BrushRef[];
  walls: BrushRef[];
  doodads: BrushRef[];
  /** Chamado depois que a nova ordem é salva com sucesso — para revalidar os dados. */
  onSaved: () => void;
  /** Reflete se há um salvamento de ordem em andamento — o dialog usa isso para bloquear
   * o fechamento ao clicar fora enquanto o PATCH ainda não terminou. */
  onDirtyChange?: (dirty: boolean) => void;
};

/** Lista arrastável dos brushes vinculados a uma categoria — a ordem é persistida
 * automaticamente a cada solta (mesmo padrão de `CategoryItemEntriesEditor`), sem exigir
 * um botão "Salvar ordem" separado. Essa ordem salva é a que sai tanto ao exportar quanto
 * ao copiar o XML do tileset. */
export function CategoryBrushOrderList({
  categoryId,
  grounds,
  walls,
  doodads,
  onSaved,
  onDirtyChange,
}: CategoryBrushOrderListProps) {
  const serverItems = mergeBrushes(grounds, walls, doodads);
  const [localItems, setLocalItems] = useState<CombinedBrush[] | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const items = localItems ?? serverItems;

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((brush) => `${brush.type}-${brush.id}` === active.id);
    const newIndex = items.findIndex((brush) => `${brush.type}-${brush.id}` === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(items, oldIndex, newIndex);
    setLocalItems(reordered);
    onDirtyChange?.(true);

    const response = await fetch(`/api/admin/tilesets/categories/${categoryId}/reorder-brushes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: reordered.map((brush, index) => ({ type: brush.type, id: brush.id, order: index })),
      }),
    });

    onDirtyChange?.(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      toast.error(body?.error ?? "Não foi possível salvar a nova ordem dos brushes.");
      setLocalItems(null);
      return;
    }

    onSaved();
  }

  if (items.length === 0) return null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((brush) => `${brush.type}-${brush.id}`)} strategy={rectSortingStrategy}>
        <ul className="flex flex-wrap gap-2">
          {items.map((brush, index) => (
            <SortableBrushTile key={`${brush.type}-${brush.id}`} brush={brush} index={index} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
