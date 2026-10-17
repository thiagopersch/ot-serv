"use client";

import useSWR from "swr";
import {
  useController,
  useFieldArray,
  type Control,
  type FieldArrayPath,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import { Button } from "@/components/ui/button";
import { FormItem } from "@/components/ui/form";
import { NumberField } from "@/components/shared/number-field";
import { EntitySearchCombobox } from "@/components/shared/entity-search-combobox";
import { MonsterThumb } from "@/components/shared/monster-thumb";
import { emptyMonsterSummon } from "@/lib/validations/admin/monster";

type MonsterRow = { id: number; name: string; lookTypeId: number | null };

/** `MonsterSummonInput.name` guarda só o nome do monstro (texto livre no XML) — resolve o id
 * pelo nome exato pra poder pré-selecionar no combobox e mostrar a sprite ao lado. */
function SummonNameField<T extends FieldValues>({
  control,
  name,
}: {
  control: Control<T>;
  name: FieldPath<T>;
}) {
  const { field } = useController({ control, name });
  const currentName = String(field.value ?? "");

  const { data } = useSWR<PaginatedResult<MonsterRow>>(
    currentName ? `/api/admin/monsters?search=${encodeURIComponent(currentName)}&pageSize=5` : null,
    fetcher,
  );
  const resolved = data?.data.find((row) => row.name.toLowerCase() === currentName.toLowerCase());

  return (
    <FormItem>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <EntitySearchCombobox<MonsterRow>
            endpoint="/api/admin/monsters"
            value={resolved?.id ?? null}
            placeholder="Buscar monstro..."
            formatOption={(row) => row.name}
            renderOption={(row) => (
              <span className="flex items-center gap-2">
                <MonsterThumb id={row.id} name={row.name} lookTypeId={row.lookTypeId} size="32" />
                {row.name}
              </span>
            )}
            onSelect={(row) => field.onChange(row?.name ?? "")}
          />
        </div>
        {resolved && (
          <MonsterThumb id={resolved.id} name={resolved.name} lookTypeId={resolved.lookTypeId} size="32" />
        )}
      </div>
    </FormItem>
  );
}

export function MonsterSummonListField<T extends FieldValues>({
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

  return (
    <div className="flex flex-col gap-2">
      {fields.length > 0 && (
        <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 text-xs text-muted-foreground">
          <span>Nome do monstro</span>
          <span>Intervalo (Interval)</span>
          <span>Chance</span>
          <span>Quantidade (Amount)</span>
          <span />
        </div>
      )}
      {fields.map((field, index) => (
        <div
          key={field.id}
          className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] items-center gap-2"
        >
          <SummonNameField control={control} name={`${name}.${index}.name` as FieldPath<T>} />
          <NumberField
            control={control}
            name={`${name}.${index}.interval` as FieldPath<T>}
          />
          <NumberField
            control={control}
            name={`${name}.${index}.chance` as FieldPath<T>}
          />
          <NumberField
            control={control}
            name={`${name}.${index}.amount` as FieldPath<T>}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => remove(index)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => append(emptyMonsterSummon as never)}
      >
        <Plus className="size-4" />
        Adicionar summon
      </Button>
    </div>
  );
}
