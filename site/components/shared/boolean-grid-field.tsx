"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { FieldTooltip } from "@/components/shared/field-tooltip";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";

type BooleanGridFieldProps<T extends FieldValues> = {
  control: Control<T>;
  basePath: string;
  keys: readonly string[];
  labels?: Record<string, string>;
  /** Texto do (i) ao lado de cada checkbox, por chave. */
  tooltips?: Record<string, string>;
};

/** Grade fixa de checkboxes para grupos JSON tipo `Record<string, boolean>` (chaves conhecidas
 * de antemão) — usado por `flags`/`suppress` do Item, mesmo estilo de `monster-flags-fields.tsx`. */
export function BooleanGridField<T extends FieldValues>({
  control,
  basePath,
  keys,
  labels,
  tooltips,
}: BooleanGridFieldProps<T>) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {keys.map((key) => (
        <FormField
          key={key}
          control={control}
          name={`${basePath}.${key}` as FieldPath<T>}
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-2">
              <FormControl>
                <input
                  type="checkbox"
                  className="size-4 cursor-pointer"
                  checked={Boolean(field.value)}
                  onChange={(event) => field.onChange(event.target.checked)}
                />
              </FormControl>
              <FormLabel className="!mt-0 font-normal">{labels?.[key] ?? key}</FormLabel>
              {tooltips?.[key] && <FieldTooltip text={tooltips[key]} />}
            </FormItem>
          )}
        />
      ))}
    </div>
  );
}
