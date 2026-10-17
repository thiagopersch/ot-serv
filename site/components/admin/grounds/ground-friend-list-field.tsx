"use client";

import useSWR from "swr";
import { useController, useFieldArray, type Control, type FieldPath } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import { emptyGroundFriend, type GroundFormInput } from "@/lib/validations/admin/ground";
import { Button } from "@/components/ui/button";
import { FormItem, FormLabel } from "@/components/ui/form";
import { EntitySearchCombobox } from "@/components/shared/entity-search-combobox";
import { EntityThumb } from "@/components/shared/entity-thumb";

type GroundFriendListFieldProps = {
  control: Control<GroundFormInput>;
};

type GroundRow = { id: number; name: string; serverLookId: number };

export function GroundFriendListField({ control }: GroundFriendListFieldProps) {
  const { fields, append, remove } = useFieldArray({ control, name: "friends" });

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Friends (ground que compartilha borda)</span>
      {fields.map((field, index) => (
        <GroundFriendRow key={field.id} control={control} index={index} onRemove={() => remove(index)} />
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => append(emptyGroundFriend)}
      >
        <Plus className="size-4" />
        Adicionar friend
      </Button>
    </div>
  );
}

function GroundFriendRow({
  control,
  index,
  onRemove,
}: {
  control: Control<GroundFormInput>;
  index: number;
  onRemove: () => void;
}) {
  const { field } = useController({
    control,
    name: `friends.${index}.name` as FieldPath<GroundFormInput>,
  });
  const currentName = String(field.value ?? "");

  const { data } = useSWR<PaginatedResult<GroundRow>>(
    currentName ? `/api/admin/grounds?search=${encodeURIComponent(currentName)}&pageSize=5` : null,
    fetcher,
  );
  const resolved = data?.data.find((row) => row.name.toLowerCase() === currentName.toLowerCase());

  return (
    <div className="flex items-end gap-2">
      <FormItem className="w-72">
        <FormLabel>Nome do ground</FormLabel>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <EntitySearchCombobox<GroundRow>
              endpoint="/api/admin/grounds"
              value={resolved?.id ?? null}
              placeholder="Buscar ground por nome ou server_lookid..."
              formatOption={(ground) => `${ground.name} (#${ground.serverLookId})`}
              renderOption={(ground) => (
                <span className="flex items-center gap-2">
                  <EntityThumb entityType="item" id={ground.serverLookId} name={ground.name} size="32" />
                  {ground.name} (#{ground.serverLookId})
                </span>
              )}
              onSelect={(ground) => field.onChange(ground?.name ?? "")}
            />
          </div>
          {resolved && (
            <EntityThumb entityType="item" id={resolved.serverLookId} name={resolved.name} size="32" />
          )}
        </div>
      </FormItem>
      <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove}>
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
