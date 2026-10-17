"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { Input } from "@/components/ui/input";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { FieldTooltip } from "@/components/shared/field-tooltip";

type NumberFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label?: string;
  step?: string;
  disabled?: boolean;
  tooltip?: string;
  /** Quando true, campo vazio vira `null` em vez de `0` — para campos numéricos opcionais
   * (ex.: `subtype` do loot) onde `0` e "sem valor" têm significados diferentes no XML. */
  nullable?: boolean;
  /** Limites aceitos — o valor digitado é travado (clamp) nesse intervalo, não só validado no
   * submit (ex.: `direction` do NPC, que só pode ser 0-3). */
  min?: number;
  max?: number;
};

export function NumberField<T extends FieldValues>({
  control,
  name,
  label,
  step = "1",
  disabled,
  tooltip,
  nullable = false,
  min,
  max,
}: NumberFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          {label && (
            <FormLabel className="flex items-center gap-1.5">
              {label}
              {tooltip && <FieldTooltip text={tooltip} />}
            </FormLabel>
          )}
          <FormControl>
            <Input
              type="number"
              step={step}
              min={min}
              max={max}
              disabled={disabled}
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              value={(field.value as number | string) ?? ""}
              onChange={(event) => {
                if (event.target.value === "") {
                  field.onChange(nullable ? null : 0);
                  return;
                }
                let next = Number(event.target.value);
                if (min !== undefined) next = Math.max(min, next);
                if (max !== undefined) next = Math.min(max, next);
                field.onChange(next);
              }}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
