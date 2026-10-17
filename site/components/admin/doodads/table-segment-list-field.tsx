"use client";

import { useFieldArray, type Control, type FieldArrayPath, type FieldPath } from "react-hook-form";
import { Plus } from "lucide-react";

import {
  TABLE_ALIGNS,
  emptyTableSegment,
  type DoodadFormInput,
} from "@/lib/validations/admin/doodad";
import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ItemsListField } from "@/components/shared/items-list-field";
import { CollapsibleFieldCard } from "@/components/shared/collapsible-field-card";

type TableSegmentListFieldProps = {
  control: Control<DoodadFormInput>;
  name: string;
};

export function TableSegmentListField({ control, name }: TableSegmentListFieldProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: name as FieldArrayPath<DoodadFormInput>,
  });

  return (
    <div className="flex flex-col gap-2">
      {fields.map((field, index) => (
        <CollapsibleFieldCard
          key={field.id}
          title={`Mesa #${index + 1}`}
          onRemove={() => remove(index)}
        >
          <FormField
            control={control}
            name={`${name}.${index}.align` as FieldPath<DoodadFormInput>}
            render={({ field: selectField }) => (
              <FormItem>
                <FormLabel>Posição</FormLabel>
                <Select
                  value={String(selectField.value)}
                  onValueChange={(value) => selectField.onChange(value)}
                >
                  <FormControl>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {TABLE_ALIGNS.map((align) => (
                      <SelectItem key={align} value={align}>
                        {align}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          <ItemsListField control={control} name={`${name}.${index}.items`} />
        </CollapsibleFieldCard>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => append(emptyTableSegment as never)}
      >
        <Plus className="size-4" />
        Adicionar segmento de mesa
      </Button>
    </div>
  );
}
