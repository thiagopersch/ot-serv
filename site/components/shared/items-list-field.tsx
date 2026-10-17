"use client";

import {
  useFieldArray,
  type Control,
  type FieldArrayPath,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/shared/number-field";
import { ItemSearchField } from "@/components/shared/item-search-field";

type ItemsListFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: string;
};

export function ItemsListField<T extends FieldValues>({ control, name }: ItemsListFieldProps<T>) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: name as FieldArrayPath<T>,
  });

  return (
    <div className="flex flex-col gap-2">
      {fields.length > 0 && (
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs text-muted-foreground">
          <span>Item ID</span>
          <span>Chance</span>
          <span />
        </div>
      )}
      {fields.map((field, index) => (
        <div key={field.id} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
          <ItemSearchField control={control} name={`${name}.${index}.id` as FieldPath<T>} />
          <NumberField control={control} name={`${name}.${index}.chance` as FieldPath<T>} />
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(index)}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => append({ id: 0, chance: 10 } as never)}
      >
        <Plus className="size-4" />
        Adicionar item
      </Button>
    </div>
  );
}
