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
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";

const emptyCustomMessage = { text: "", intervalMs: 30000, chance: 100 };

/** Falas ambiente ditas espontaneamente pelo NPC (ex.: "Ajude-me!" a cada X segundos, Y% de
 * chance) — igual às falas de NPCs do Tibia Global. Só tem efeito quando o NPC não tem um
 * Script Lua próprio vinculado (ver `buildNpcScriptWithMessages` em `lib/npc-xml.ts`). */
export function NpcCustomMessageListField<T extends FieldValues>({
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
        <div key={field.id} className="grid grid-cols-[1fr_auto_auto_auto] items-end gap-2">
          <FormField
            control={control}
            name={`${name}.${index}.text` as FieldPath<T>}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mensagem</FormLabel>
                <FormControl>
                  <Input {...field} value={String(field.value ?? "")} placeholder="Ex.: Ajude-me!" />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`${name}.${index}.intervalMs` as FieldPath<T>}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Intervalo (ms)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    className="w-28"
                    value={Number(field.value ?? 30000)}
                    onChange={(event) => field.onChange(Number(event.target.value) || 1000)}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`${name}.${index}.chance` as FieldPath<T>}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Chance (%)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    className="w-20"
                    value={Number(field.value ?? 100)}
                    onChange={(event) => field.onChange(Number(event.target.value) || 1)}
                  />
                </FormControl>
              </FormItem>
            )}
          />
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
        onClick={() => append(emptyCustomMessage as never)}
      >
        <Plus className="size-4" />
        Adicionar fala
      </Button>
    </div>
  );
}
