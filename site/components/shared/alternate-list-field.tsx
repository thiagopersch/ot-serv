"use client";

import { useFieldArray, type Control, type FieldArrayPath, type FieldValues } from "react-hook-form";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ItemsListField } from "@/components/shared/items-list-field";
import { CompositeListField } from "@/components/shared/composite-list-field";
import { CollapsibleFieldCard } from "@/components/shared/collapsible-field-card";

type AlternateListFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: string;
};

export function AlternateListField<T extends FieldValues>({ control, name }: AlternateListFieldProps<T>) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: name as FieldArrayPath<T>,
  });

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Alternates (variações independentes)</span>
      {fields.map((field, index) => (
        <CollapsibleFieldCard
          key={field.id}
          title={`Alternate #${index + 1}`}
          onRemove={() => remove(index)}
        >
          <ItemsListField control={control} name={`${name}.${index}.items`} />
          <CompositeListField control={control} name={`${name}.${index}.composites`} />
        </CollapsibleFieldCard>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => append({ items: [], composites: [] } as never)}
      >
        <Plus className="size-4" />
        Adicionar alternate
      </Button>
    </div>
  );
}
