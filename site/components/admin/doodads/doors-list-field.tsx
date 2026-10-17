"use client";

import { useFieldArray, type Control, type FieldArrayPath, type FieldPath } from "react-hook-form";
import { Plus } from "lucide-react";

import { DOOR_TYPES, emptyWallDoor, type DoodadFormInput } from "@/lib/validations/admin/doodad";
import { Button } from "@/components/ui/button";
import { ItemSearchField } from "@/components/shared/item-search-field";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CollapsibleFieldCard } from "@/components/shared/collapsible-field-card";

type DoorsListFieldProps = {
  control: Control<DoodadFormInput>;
  name: string;
};

export function DoorsListField({ control, name }: DoorsListFieldProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: name as FieldArrayPath<DoodadFormInput>,
  });

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">Portas/janelas (opcional)</span>
      {fields.map((field, index) => (
        <CollapsibleFieldCard
          key={field.id}
          title={`Porta/janela #${index + 1}`}
          onRemove={() => remove(index)}
        >
          <div className="flex flex-wrap items-end gap-2">
            <ItemSearchField
              control={control}
              name={`${name}.${index}.id` as FieldPath<DoodadFormInput>}
              label="Item"
            />

            <FormField
              control={control}
              name={`${name}.${index}.type` as FieldPath<DoodadFormInput>}
              render={({ field: selectField }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select
                    value={String(selectField.value)}
                    onValueChange={(value) => selectField.onChange(value)}
                  >
                    <FormControl>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DOOR_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name={`${name}.${index}.open` as FieldPath<DoodadFormInput>}
              render={({ field: checkboxField }) => (
                <FormItem className="flex flex-row items-center gap-1.5">
                  <FormControl>
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={Boolean(checkboxField.value)}
                      onChange={(event) => checkboxField.onChange(event.target.checked)}
                    />
                  </FormControl>
                  <FormLabel className="!mt-0">Aberta</FormLabel>
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name={`${name}.${index}.hate` as FieldPath<DoodadFormInput>}
              render={({ field: checkboxField }) => (
                <FormItem className="flex flex-row items-center gap-1.5">
                  <FormControl>
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={Boolean(checkboxField.value)}
                      onChange={(event) => checkboxField.onChange(event.target.checked)}
                    />
                  </FormControl>
                  <FormLabel className="!mt-0">Hate door</FormLabel>
                </FormItem>
              )}
            />
          </div>
        </CollapsibleFieldCard>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => append(emptyWallDoor as never)}
      >
        <Plus className="size-4" />
        Adicionar porta/janela
      </Button>
    </div>
  );
}
