"use client";

import { useMemo, useState } from "react";
import {
  useFieldArray,
  useWatch,
  type Control,
  type FieldArrayPath,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
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
  horizontalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";

import {
  BATTLE_PASS_TRACKS,
  BATTLE_PASS_TRACK_LABELS,
  BATTLE_PASS_RARITIES,
  BATTLE_PASS_RARITY_LABELS,
  type BattlePassRewardInput,
} from "@/lib/validations/admin/battle-pass";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NumberField } from "@/components/shared/number-field";
import { EntitySearchCombobox } from "@/components/shared/entity-search-combobox";
import { EntityThumb } from "@/components/shared/entity-thumb";

type NamedRow = { id: number; name: string };

const emptyReward: BattlePassRewardInput = {
  level: 1,
  track: "bronze",
  rarity: "comum",
  itemId: 0,
  count: 1,
  order: 0,
};

export function BattlePassRewardListField<T extends FieldValues>({
  control,
  name,
}: {
  control: Control<T>;
  name: string;
}) {
  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: name as FieldArrayPath<T>,
  });
  const values = useWatch({ control, name: name as FieldPath<T> }) as
    | BattlePassRewardInput[]
    | undefined;
  const rewards = values ?? [];

  const [editing, setEditing] = useState<{ index: number; isNew: boolean } | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, { level: number; track: string; indexes: number[] }>();
    rewards.forEach((reward, index) => {
      const key = `${reward.track}_${reward.level}`;
      const group = map.get(key) ?? { level: reward.level, track: reward.track, indexes: [] };
      group.indexes.push(index);
      map.set(key, group);
    });
    return [...map.values()].sort(
      (a, b) => a.track.localeCompare(b.track) || a.level - b.level,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `rewards` é derivado de `values` no mesmo render
  }, [values]);

  function handleAdd() {
    const index = fields.length;
    append(emptyReward as never);
    setEditing({ index, isNew: true });
  }

  function handleCancelNew() {
    if (editing) remove(editing.index);
    setEditing(null);
  }

  function handleDuplicate(index: number) {
    const source = rewards[index];
    append({ ...source } as never);
  }

  function handleReorderGroup(indexes: number[], oldIndex: number, newIndex: number) {
    const reorderedIndexes = arrayMove(indexes, oldIndex, newIndex);
    const next = [...rewards];
    reorderedIndexes.forEach((originalIndex, position) => {
      next[originalIndex] = { ...next[originalIndex], order: position };
    });
    replace(next as never);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Recompensas por level</span>
        <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
          <Plus className="size-4" />
          Adicionar
        </Button>
      </div>

      {groups.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhuma recompensa adicionada.</p>
      )}

      <div className="flex flex-col gap-3">
        {groups.map((group) => (
          <RewardGroupRow
            key={`${group.track}_${group.level}`}
            level={group.level}
            track={group.track}
            indexes={group.indexes}
            rewards={rewards}
            onReorder={(oldIndex, newIndex) => handleReorderGroup(group.indexes, oldIndex, newIndex)}
            onEdit={(index) => setEditing({ index, isNew: false })}
            onDuplicate={handleDuplicate}
            onRemove={remove}
          />
        ))}
      </div>

      {editing && (
        <Dialog open onOpenChange={(next) => !next && setEditing(null)}>
          <DialogContent className="flex max-h-[90vh] flex-col overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing.isNew ? "Adicionar recompensa" : "Editar recompensa"}</DialogTitle>
            </DialogHeader>
            <RewardFields control={control} basePath={`${name}.${editing.index}`} />
            <DialogFooter className="sm:justify-between">
              {editing.isNew ? (
                <Button type="button" variant="outline" onClick={handleCancelNew}>
                  Cancelar
                </Button>
              ) : (
                <span />
              )}
              <Button type="button" onClick={() => setEditing(null)}>
                Concluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function RewardGroupRow({
  level,
  track,
  indexes,
  rewards,
  onReorder,
  onEdit,
  onDuplicate,
  onRemove,
}: {
  level: number;
  track: string;
  indexes: number[];
  rewards: BattlePassRewardInput[];
  onReorder: (oldIndex: number, newIndex: number) => void;
  onEdit: (index: number) => void;
  onDuplicate: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const sortedIndexes = [...indexes].sort(
    (a, b) => (rewards[a].order ?? 0) - (rewards[b].order ?? 0),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortedIndexes.indexOf(Number(active.id));
    const newIndex = sortedIndexes.indexOf(Number(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(oldIndex, newIndex);
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Level {level}</span>
        <Badge variant="outline">{BATTLE_PASS_TRACK_LABELS[track as (typeof BATTLE_PASS_TRACKS)[number]]}</Badge>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortedIndexes} strategy={horizontalListSortingStrategy}>
          <div className="flex flex-wrap gap-2">
            {sortedIndexes.map((index) => (
              <RewardCard
                key={rewards[index].itemId + "-" + index}
                index={index}
                reward={rewards[index]}
                onEdit={() => onEdit(index)}
                onDuplicate={() => onDuplicate(index)}
                onRemove={() => onRemove(index)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function RewardCard({
  index,
  reward,
  onEdit,
  onDuplicate,
  onRemove,
}: {
  index: number;
  reward: BattlePassRewardInput;
  onEdit: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: index,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative flex w-28 flex-col items-center gap-1 rounded-md border bg-card p-2 text-center"
    >
      <div className="flex w-full items-center justify-between">
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
        <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button type="button" variant="ghost" size="icon-sm" title="Editar" onClick={onEdit}>
            <Pencil className="size-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" title="Duplicar" onClick={onDuplicate}>
            <Copy className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title="Remover"
            className="text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <button type="button" onClick={onEdit} className="flex flex-col items-center gap-1">
        <EntityThumb entityType="item" id={reward.itemId} size="lg" zoomOnHover={false} />
        <p className="text-[11px] text-muted-foreground">
          ×{reward.count} · {BATTLE_PASS_RARITY_LABELS[reward.rarity]}
        </p>
      </button>
    </div>
  );
}

function RewardFields<T extends FieldValues>({
  control,
  basePath,
}: {
  control: Control<T>;
  basePath: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <NumberField control={control} name={`${basePath}.level` as never} label="Level" />
        <FormField
          control={control}
          name={`${basePath}.track` as never}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Trilha</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Trilha" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {BATTLE_PASS_TRACKS.map((track) => (
                    <SelectItem key={track} value={track}>
                      {BATTLE_PASS_TRACK_LABELS[track]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={control}
        name={`${basePath}.rarity` as never}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Raridade</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Raridade" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {BATTLE_PASS_RARITIES.map((rarity) => (
                  <SelectItem key={rarity} value={rarity}>
                    {BATTLE_PASS_RARITY_LABELS[rarity]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={`${basePath}.itemId` as never}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Item</FormLabel>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <EntitySearchCombobox<NamedRow>
                  endpoint="/api/admin/items"
                  value={field.value || null}
                  placeholder="Buscar item..."
                  formatOption={(item) => `${item.name} (#${item.id})`}
                  renderOption={(item) => (
                    <span className="flex items-center gap-2">
                      <EntityThumb entityType="item" id={item.id} name={item.name} size="32" />
                      {item.name} (#{item.id})
                    </span>
                  )}
                  onSelect={(item) => field.onChange(item?.id ?? 0)}
                />
              </div>
              {field.value > 0 && <EntityThumb entityType="item" id={field.value} size="32" />}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
      <NumberField control={control} name={`${basePath}.count` as never} label="Quantidade" />
    </div>
  );
}
