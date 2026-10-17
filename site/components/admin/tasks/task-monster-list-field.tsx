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
import { MonsterThumb } from "@/components/shared/monster-thumb";
import { MonsterThumbByName } from "@/components/admin/tasks/monster-thumb-by-name";

type TaskMonsterValue = { name: string; kills: number };

const emptyTaskMonster: TaskMonsterValue = { name: "", kills: 100 };

/** Monstros exigidos pela task — grid de cards com sprite animada e nome abaixo, mesma ideia
 * visual da tab de Loot dos monstros, em vez da lista sempre expandida. */
export function TaskMonsterListField<T extends FieldValues>({
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
    append(emptyTaskMonster as never);
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
        Adicionar monstro
      </Button>

      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum monstro adicionado.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {fields.map((field, index) => (
            <TaskMonsterCard
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
              <DialogTitle>{editing.isNew ? "Adicionar monstro" : "Editar monstro"}</DialogTitle>
            </DialogHeader>
            <TaskMonsterFields control={control} basePath={`${name}.${editing.index}`} />
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

function TaskMonsterCard<T extends FieldValues>({
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
  const value = useWatch({ control, name: basePath as FieldPath<T> }) as TaskMonsterValue;

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
        {value.name ? (
          <MonsterThumbByName name={value.name} size="lg" zoomOnHover={false} />
        ) : (
          <div className="flex size-16 items-center justify-center rounded-sm border border-dashed border-border text-xs text-muted-foreground">
            —
          </div>
        )}
        <p className="line-clamp-1 text-xs font-medium">{value.name || "Sem monstro"}</p>
        <p className="text-[11px] text-muted-foreground">× {value.kills} kills</p>
      </button>
    </div>
  );
}

function TaskMonsterFields<T extends FieldValues>({
  control,
  basePath,
}: {
  control: Control<T>;
  basePath: string;
}) {
  const nameController = useController({ control, name: `${basePath}.name` as FieldPath<T> });
  const monsterName = (nameController.field.value as string | null) ?? "";

  return (
    <div className="flex flex-col gap-3">
      <FormItem>
        <FormLabel>Monstro</FormLabel>
        <EntitySearchCombobox<{ id: number; name: string; lookTypeId: number | null }>
          endpoint="/api/admin/monsters"
          value={null}
          placeholder={monsterName || "Buscar monstro..."}
          formatOption={(monster) => monster.name}
          renderOption={(monster) => (
            <span className="flex items-center gap-2">
              <MonsterThumb id={monster.id} name={monster.name} lookTypeId={monster.lookTypeId} size="32" />
              {monster.name}
            </span>
          )}
          onSelect={(monster) => nameController.field.onChange(monster?.name ?? "")}
        />
      </FormItem>

      <NumberField control={control} name={`${basePath}.kills` as FieldPath<T>} label="Kills" />
    </div>
  );
}
