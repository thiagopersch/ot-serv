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
import { TileListField } from "@/components/shared/tile-list-field";
import { CollapsibleFieldCard } from "@/components/shared/collapsible-field-card";

type CompositeListFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: string;
  label?: string;
};

export function CompositeListField<T extends FieldValues>({
  control,
  name,
  label = "Composites (objeto multi-tile)",
}: CompositeListFieldProps<T>) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: name as FieldArrayPath<T>,
  });

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      {fields.map((field, index) => (
        <CollapsibleFieldCard
          key={field.id}
          title={`Composite #${index + 1}`}
          onRemove={() => remove(index)}
        >
          <div className="w-24">
            <NumberField
              control={control}
              name={`${name}.${index}.chance` as FieldPath<T>}
              label="Chance"
            />
          </div>
          <TileListField control={control} name={`${name}.${index}.tiles`} />
        </CollapsibleFieldCard>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => append({ chance: 10, tiles: [] } as never)}
      >
        <Plus className="size-4" />
        Adicionar composite
      </Button>
    </div>
  );
}
