"use client";

import {
  useFieldArray,
  type Control,
  type FieldArrayPath,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem } from "@/components/ui/form";
import { emptyMonsterVoice } from "@/lib/validations/admin/monster";

export function MonsterVoiceListField<T extends FieldValues>({
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
      {fields.map((field, index) => (
        <div
          key={field.id}
          className="grid grid-cols-[1fr_auto_auto] items-center gap-2"
        >
          <FormField
            control={control}
            name={`${name}.${index}.sentence` as FieldPath<T>}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    {...field}
                    value={String(field.value ?? "")}
                    placeholder="Sentença..."
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`${name}.${index}.yell` as FieldPath<T>}
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-2">
                <FormControl>
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={Boolean(field.value)}
                    onChange={(event) => field.onChange(event.target.checked)}
                  />
                </FormControl>
                <span className="text-sm">Gritar (Yell)</span>
              </FormItem>
            )}
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
        onClick={() => append(emptyMonsterVoice as never)}
      >
        <Plus className="size-4" />
        Adicionar fala
      </Button>
    </div>
  );
}
