"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FieldTooltip } from "@/components/shared/field-tooltip";

type OptionRadioFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label?: string;
  tooltip?: string;
  options: { value: number; label: string }[];
  orientation?: "horizontal" | "vertical";
};

/** Grupo de opções mutuamente exclusivas (radio) para campos numéricos com um conjunto pequeno
 * e fixo de valores — ex.: direção do NPC (0-3) ou addons de outfit (0-3), onde um número cru
 * é menos claro que rótulos nomeados. */
export function OptionRadioField<T extends FieldValues>({
  control,
  name,
  label,
  tooltip,
  options,
  orientation = "vertical",
}: OptionRadioFieldProps<T>) {
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
          <RadioGroup
            orientation={orientation}
            value={field.value}
            onValueChange={(value) => field.onChange(value)}
          >
            {options.map((option) => (
              <label key={option.value} className="flex items-center gap-1.5 text-sm">
                <RadioGroupItem value={option.value} />
                {option.label}
              </label>
            ))}
          </RadioGroup>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
