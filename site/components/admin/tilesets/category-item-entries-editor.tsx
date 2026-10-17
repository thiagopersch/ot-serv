"use client";

import { useState } from "react";
import useSWR from "swr";
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
import { GripVertical, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import type { TilesetItemEntryFormInput } from "@/lib/validations/admin/tileset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EntityThumb } from "@/components/shared/entity-thumb";

/** Máximo de sprites mostradas no tooltip de um intervalo — intervalos podem ter milhares de
 * ids, então limitamos pra não travar o navegador montando centenas de `EntityThumb`. */
const RANGE_TOOLTIP_MAX = 100;
const RANGE_TOOLTIP_COLUMNS = 10;

function ItemRangeTooltip({ fromId, toId }: { fromId: number; toId: number }) {
  const total = toId - fromId + 1;
  const ids = Array.from({ length: Math.min(total, RANGE_TOOLTIP_MAX) }, (_, index) => fromId + index);
  const rows: number[][] = [];
  for (let index = 0; index < ids.length; index += RANGE_TOOLTIP_COLUMNS) {
    rows.push(ids.slice(index, index + RANGE_TOOLTIP_COLUMNS));
  }

  return (
    <div className="flex flex-col gap-1">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex gap-1">
          {row.map((id) => (
            <EntityThumb key={id} entityType="item" id={id} size="sm" />
          ))}
        </div>
      ))}
      {total > RANGE_TOOLTIP_MAX && (
        <span className="text-xs text-muted-foreground">+{total - RANGE_TOOLTIP_MAX} mais</span>
      )}
    </div>
  );
}

const KIND_LABELS: Record<"ITEM_ID" | "ITEM_RANGE", string> = {
  ITEM_ID: "ID único",
  ITEM_RANGE: "Intervalo",
};

type EntryRow = TilesetItemEntryFormInput & { id: number };

export function CategoryItemEntriesEditor({ categoryId, onChanged }: { categoryId: number; onChanged: () => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const { data, mutate } = useSWR<{ entries: EntryRow[] }>(
    `/api/admin/tilesets/categories/${categoryId}/entries`,
    fetcher
  );
  const entries = data?.entries ?? [];

  const [kind, setKind] = useState<"ITEM_ID" | "ITEM_RANGE">("ITEM_ID");
  const [itemId, setItemId] = useState("");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  const rangeInvalid =
    kind === "ITEM_RANGE" && fromId !== "" && toId !== "" && Number(toId) < Number(fromId);

  const searchTerm = search.trim();
  const searchId = searchTerm === "" ? NaN : Number(searchTerm);
  const filteredEntries =
    searchTerm === ""
      ? entries
      : entries.filter((entry) =>
          entry.kind === "ITEM_ID"
            ? String(entry.itemId ?? "").includes(searchTerm)
            : Number.isFinite(searchId)
              ? (entry.fromId ?? Infinity) <= searchId && searchId <= (entry.toId ?? -Infinity)
              : String(entry.fromId ?? "").includes(searchTerm) || String(entry.toId ?? "").includes(searchTerm)
        );

  async function handleAdd() {
    const payload: Partial<TilesetItemEntryFormInput> = {
      order: entries.length,
      kind,
      itemId: kind === "ITEM_ID" ? Number(itemId) : null,
      fromId: kind === "ITEM_RANGE" ? Number(fromId) : null,
      toId: kind === "ITEM_RANGE" ? Number(toId) : null,
    };

    setIsSubmitting(true);
    const response = await fetch(`/api/admin/tilesets/categories/${categoryId}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setIsSubmitting(false);
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(body?.error ?? "Não foi possível adicionar a entrada.");
      return;
    }

    setItemId("");
    setFromId("");
    setToId("");
    mutate();
    onChanged();
  }

  async function handleDelete(entryId: number) {
    const response = await fetch(`/api/admin/tilesets/categories/${categoryId}/entries/${entryId}`, {
      method: "DELETE",
    });
    if (!response.ok) toast.error("Não foi possível remover a entrada.");
    mutate();
    onChanged();
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = entries.findIndex((e) => e.id === active.id);
    const newIndex = entries.findIndex((e) => e.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(entries, oldIndex, newIndex);
    mutate({ entries: reordered }, false);

    const response = await fetch("/api/admin/tilesets/entries/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: reordered.map((e, index) => ({ id: e.id, order: index })) }),
    });

    if (!response.ok) toast.error("Não foi possível salvar a nova ordem.");
    mutate();
  }

  return (
    <div className="flex flex-col gap-4">
      {entries.length > 0 && (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por ID (único ou dentro de um intervalo)..."
            className="pl-8"
          />
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma entrada ainda — use o formulário abaixo.</p>
        ) : filteredEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma entrada encontrada para &quot;{searchTerm}&quot;.</p>
        ) : (
          <SortableContext items={filteredEntries.map((e) => e.id)} strategy={rectSortingStrategy}>
            <div className="flex flex-wrap gap-2">
              {filteredEntries.map((entry) => (
                <EntryRowItem key={entry.id} entry={entry} onDelete={() => handleDelete(entry.id)} />
              ))}
            </div>
          </SortableContext>
        )}
      </DndContext>

      <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Tipo</span>
          <Select value={kind} onValueChange={(v) => v && setKind(v as "ITEM_ID" | "ITEM_RANGE")}>
            <SelectTrigger className="w-40">
              <SelectValue>
                {(value: "ITEM_ID" | "ITEM_RANGE") => KIND_LABELS[value] ?? value}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ITEM_ID">{KIND_LABELS.ITEM_ID}</SelectItem>
              <SelectItem value="ITEM_RANGE">{KIND_LABELS.ITEM_RANGE}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {kind === "ITEM_ID" ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Item ID</span>
            <div className="flex items-center gap-2">
              <EntityThumb entityType="item" id={Number(itemId) || 0} />
              <Input type="number" value={itemId} onChange={(e) => setItemId(e.target.value)} className="w-28" />
              <Button type="button" onClick={handleAdd} disabled={isSubmitting || rangeInvalid}>
                <Plus className="size-4" />
                Adicionar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">De</span>
              <Input type="number" value={fromId} onChange={(e) => setFromId(e.target.value)} className="w-24" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Até</span>
              <Input type="number" value={toId} onChange={(e) => setToId(e.target.value)} className="w-24" />
            </div>
            <Button type="button" onClick={handleAdd} disabled={isSubmitting || rangeInvalid}>
              <Plus className="size-4" />
              Adicionar
            </Button>
            {rangeInvalid && (
              <p className="w-full text-sm text-destructive">
                O campo &quot;Até&quot; deve ser maior ou igual ao campo &quot;De&quot;.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EntryRowItem({ entry, onDelete }: { entry: EntryRow; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-md border p-2 text-sm">
      <button type="button" className="cursor-grab touch-none text-muted-foreground" {...attributes} {...listeners}>
        <GripVertical className="size-4" />
      </button>
      <span className="flex flex-1 items-center gap-2">
        {entry.kind === "ITEM_ID" ? (
          <>
            <EntityThumb entityType="item" id={entry.itemId ?? 0} />
            ID único — <code>{entry.itemId}</code>
          </>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="cursor-help">
                    Intervalo — <code>{entry.fromId}</code> a <code>{entry.toId}</code>
                  </span>
                }
              />
              <TooltipContent className="max-w-none">
                <ItemRangeTooltip fromId={entry.fromId ?? 0} toId={entry.toId ?? 0} />
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </span>
      <Button variant="ghost" size="icon-sm" onClick={onDelete} title="Remover entrada">
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
