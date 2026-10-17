"use client";

import {
  useFieldArray,
  type Control,
  type FieldArrayPath,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/shared/number-field";
import { ItemsListField } from "@/components/shared/items-list-field";
import { CollapsibleFieldCard } from "@/components/shared/collapsible-field-card";

type TileListFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: string;
};

export function TileListField<T extends FieldValues>({ control, name }: TileListFieldProps<T>) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: name as FieldArrayPath<T>,
  });

  return (
    <div className="flex flex-col gap-2 pl-4">
      {fields.map((field, index) => (
        <CollapsibleFieldCard
          key={field.id}
          title={`Tile #${index + 1}`}
          onRemove={() => remove(index)}
          className="bg-muted/30"
        >
          <div className="grid grid-cols-3 gap-2">
            <NumberField control={control} name={`${name}.${index}.x` as FieldPath<T>} label="x" />
            <NumberField control={control} name={`${name}.${index}.y` as FieldPath<T>} label="y" />
            <NumberField control={control} name={`${name}.${index}.z` as FieldPath<T>} label="z (opcional)" />
          </div>
          <ItemsListField control={control} name={`${name}.${index}.items`} />
        </CollapsibleFieldCard>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => append({ x: 0, y: 0, z: null, items: [] } as never)}
      >
        <Plus className="size-4" />
        Adicionar tile
      </Button>
    </div>
  );
}
