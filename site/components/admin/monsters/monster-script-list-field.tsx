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
import { EntitySearchCombobox } from "@/components/shared/entity-search-combobox";

type LuaScriptRow = { id: number; name: string };

/** `Monster.script` guarda só o nome do evento (`LuaScript.name`, ex.: `sql_creaturescripts`
 * do cadastro de Script Lua) — resolve o id pelo nome exato pra pré-selecionar no combobox. */
function ScriptNameField<T extends FieldValues>({
  control,
  name,
}: {
  control: Control<T>;
  name: FieldPath<T>;
}) {
  const { field } = useController({ control, name });
  const currentName = String(field.value ?? "");

  const { data } = useSWR<PaginatedResult<LuaScriptRow>>(
    currentName ? `/api/admin/lua-scripts?search=${encodeURIComponent(currentName)}&pageSize=5` : null,
    fetcher,
  );
  const resolved = data?.data.find((row) => row.name.toLowerCase() === currentName.toLowerCase());

  return (
    <FormItem className="flex-1">
      <EntitySearchCombobox<LuaScriptRow>
        endpoint="/api/admin/lua-scripts"
        value={resolved?.id ?? null}
        placeholder="Buscar script Lua..."
        formatOption={(row) => row.name}
        onSelect={(row) => field.onChange(row?.name ?? "")}
      />
    </FormItem>
  );
}

export function MonsterScriptListField<T extends FieldValues>({
  control,
  name,
}: {
  control: Control<T>;
  name: string;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: name as FieldArrayPath<T> });

  return (
    <div className="flex flex-col gap-2">
      {fields.map((field, index) => (
        <div key={field.id} className="flex items-center gap-2">
          <ScriptNameField control={control} name={`${name}.${index}` as FieldPath<T>} />
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
        onClick={() => append("" as never)}
      >
        <Plus className="size-4" />
        Adicionar evento de script
      </Button>
    </div>
  );
}
