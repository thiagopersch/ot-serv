"use client";

import useSWR from "swr";
import { useController, useFieldArray, type Control, type FieldArrayPath, type FieldPath } from "react-hook-form";
import { Plus } from "lucide-react";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import { emptyFriend, type WallFormInput } from "@/lib/validations/admin/wall";
import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { EntitySearchCombobox } from "@/components/shared/entity-search-combobox";
import { CollapsibleFieldCard } from "@/components/shared/collapsible-field-card";

type FriendListFieldProps = {
  control: Control<WallFormInput>;
  name: string;
};

type WallRow = { id: number; name: string };

export function FriendListField({ control, name }: FriendListFieldProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: name as FieldArrayPath<WallFormInput>,
  });

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">
        Friends (redireciona/mescla borda com outro brush)
      </span>
      {fields.map((field, index) => (
        <FriendRow key={field.id} control={control} name={name} index={index} onRemove={() => remove(index)} />
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => append(emptyFriend as never)}
      >
        <Plus className="size-4" />
        Adicionar friend
      </Button>
    </div>
  );
}

function FriendRow({
  control,
  name,
  index,
  onRemove,
}: {
  control: Control<WallFormInput>;
  name: string;
  index: number;
  onRemove: () => void;
}) {
  const { field } = useController({
    control,
    name: `${name}.${index}.name` as FieldPath<WallFormInput>,
  });
  const currentName = String(field.value ?? "");

  const { data } = useSWR<PaginatedResult<WallRow>>(
    currentName ? `/api/admin/walls?search=${encodeURIComponent(currentName)}&pageSize=5` : null,
    fetcher,
  );
  const resolved = data?.data.find((row) => row.name.toLowerCase() === currentName.toLowerCase());

  return (
    <CollapsibleFieldCard
      title={`Friend #${index + 1}`}
      onRemove={onRemove}
      className="bg-muted/30"
    >
      <div className="flex flex-col gap-2">
        <FormField
          control={control}
          name={`${name}.${index}.redirect` as FieldPath<WallFormInput>}
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
              <FormLabel className="!mt-0">Redirect</FormLabel>
            </FormItem>
          )}
        />

        <FormItem className="w-64">
          <FormLabel>Nome do brush</FormLabel>
          <EntitySearchCombobox<WallRow>
            endpoint="/api/admin/walls"
            value={resolved?.id ?? null}
            placeholder="Buscar wall por nome..."
            formatOption={(wall) => wall.name}
            onSelect={(wall) => field.onChange(wall?.name ?? "")}
          />
        </FormItem>
      </div>
    </CollapsibleFieldCard>
  );
}
