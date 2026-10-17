"use client";

import { useState } from "react";
import {
  useController,
  useFieldArray,
  useWatch,
  type Control,
  type FieldArrayPath,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormItem, FormLabel } from "@/components/ui/form";
import { NumberField } from "@/components/shared/number-field";
import { EntitySearchCombobox } from "@/components/shared/entity-search-combobox";
import { EntityThumb } from "@/components/shared/entity-thumb";
import { useItemName } from "@/components/shared/use-item-name";

type RewardItemValue = { itemId: number; count: number };

const emptyRewardItem: RewardItemValue = { itemId: 0, count: 1 };

/** Itens de recompensa da quest — grid de cards + dialog de adicionar/editar, mesmo padrão da
 * tab de Loot dos monstros (evita a página crescer demais quando há muitos itens). */
export function QuestRewardItemListField<T extends FieldValues>({
  control,
  name,
}: {
  control: Control<T>;
  name: string;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: name as FieldArrayPath<T>,
  });
  const [editing, setEditing] = useState<{ index: number; isNew: boolean } | null>(null);

  function handleAdd() {
    const index = fields.length;
    append(emptyRewardItem as never);
    setEditing({ index, isNew: true });
  }

  function handleCancelNew() {
    if (editing) remove(editing.index);
    setEditing(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={handleAdd}>
        <Plus className="size-4" />
        Adicionar item
      </Button>

      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum item de recompensa.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {fields.map((field, index) => (
            <RewardItemCard
              key={field.id}
              control={control}
              basePath={`${name}.${index}`}
              onEdit={() => setEditing({ index, isNew: false })}
              onRemove={() => remove(index)}
            />
          ))}
        </div>
      )}

      {editing && (
        <Dialog open onOpenChange={(next) => !next && setEditing(null)}>
          <DialogContent className="flex max-h-[90vh] flex-col overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing.isNew ? "Adicionar item de recompensa" : "Editar item de recompensa"}</DialogTitle>
            </DialogHeader>
            <RewardItemFields control={control} basePath={`${name}.${editing.index}`} />
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

function RewardItemCard<T extends FieldValues>({
  control,
  basePath,
  onEdit,
  onRemove,
}: {
  control: Control<T>;
  basePath: string;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const value = useWatch({ control, name: basePath as FieldPath<T> }) as RewardItemValue;
  const name = useItemName(value.itemId || null);

  return (
    <div className="group relative flex flex-col items-center gap-1.5 rounded-md border p-2 text-center">
      <div className="flex w-full items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <Button type="button" variant="ghost" size="icon-sm" title="Editar" onClick={onEdit}>
          <Pencil className="size-3.5" />
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

      <button type="button" onClick={onEdit} className="flex flex-col items-center gap-1.5">
        <EntityThumb entityType="item" id={value.itemId} name={name ?? undefined} size="lg" zoomOnHover={false} />
        <p className="line-clamp-1 text-xs font-medium">
          {name ?? (value.itemId > 0 ? `Item #${value.itemId}` : "Sem item")}
        </p>
        <p className="text-[11px] text-muted-foreground">×{value.count}</p>
      </button>
    </div>
  );
}

function RewardItemFields<T extends FieldValues>({
  control,
  basePath,
}: {
  control: Control<T>;
  basePath: string;
}) {
  const idController = useController({ control, name: `${basePath}.itemId` as FieldPath<T> });
  const itemId = idController.field.value as number | null | undefined;

  return (
    <div className="flex flex-col gap-3">
      <FormItem>
        <FormLabel>Item</FormLabel>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <EntitySearchCombobox<{ id: number; name: string }>
              endpoint="/api/admin/items"
              value={itemId || null}
              placeholder="Buscar item por nome ou id..."
              formatOption={(item) => `${item.name} (#${item.id})`}
              renderOption={(item) => (
                <span className="flex items-center gap-2">
                  <EntityThumb entityType="item" id={item.id} name={item.name} size="32" />
                  {item.name} (#{item.id})
                </span>
              )}
              onSelect={(item) => idController.field.onChange(item?.id ?? 0)}
            />
          </div>
          {Boolean(itemId) && <EntityThumb entityType="item" id={itemId as number} size="32" />}
        </div>
      </FormItem>

      <NumberField control={control} name={`${basePath}.count` as FieldPath<T>} label="Quantidade" />
    </div>
  );
}
