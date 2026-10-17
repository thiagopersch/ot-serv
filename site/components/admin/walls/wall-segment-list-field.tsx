"use client";

import { useFieldArray, type Control, type FieldArrayPath, type FieldPath } from "react-hook-form";
import { Plus } from "lucide-react";

import { emptyWallSegment, type WallFormInput } from "@/lib/validations/admin/wall";
import { WALL_SEGMENT_TYPES } from "@/lib/validations/admin/doodad";
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
import { WallDoorListField } from "@/components/admin/walls/wall-door-list-field";
import { CollapsibleFieldCard } from "@/components/shared/collapsible-field-card";

type WallSegmentListFieldProps = {
  control: Control<WallFormInput>;
  name: string;
};

export function WallSegmentListField({ control, name }: WallSegmentListFieldProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: name as FieldArrayPath<WallFormInput>,
  });

  return (
    <div className="flex flex-col gap-2">
      {fields.map((field, index) => (
        <CollapsibleFieldCard
          key={field.id}
          title={`Segmento #${index + 1}`}
          onRemove={() => remove(index)}
        >
          <FormField
            control={control}
            name={`${name}.${index}.type` as FieldPath<WallFormInput>}
            render={({ field: selectField }) => (
              <FormItem>
                <FormLabel>Posição</FormLabel>
                <Select
                  value={String(selectField.value)}
                  onValueChange={(value) => selectField.onChange(value)}
                >
                  <FormControl>
                    <SelectTrigger className="w-56">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {WALL_SEGMENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          <ItemsListField control={control} name={`${name}.${index}.items`} />
          <WallDoorListField control={control} name={`${name}.${index}.doors`} />
        </CollapsibleFieldCard>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => append(emptyWallSegment as never)}
      >
        <Plus className="size-4" />
        Adicionar segmento de parede
      </Button>
    </div>
  );
}
