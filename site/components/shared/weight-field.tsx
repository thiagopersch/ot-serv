"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FieldTooltip } from "@/components/shared/field-tooltip";
import { centiOzToInput } from "@/lib/item-display";

/** Input em oz com máscara estilo moeda: só dígitos são aceitos e a vírgula é implícita —
 * digitar 2550 mostra 25.50 (o valor do form é o inteiro em centi-oz, igual ao items.xml). */
function OzInput({
  value,
  onChange,
  onBlur,
  name,
  inputRef,
}: {
  value: number | null | undefined;
  onChange: (centiOz: number) => void;
  onBlur: () => void;
  name: string;
  inputRef: React.Ref<HTMLInputElement>;
}) {
  return (
    <div className="flex items-center gap-2">
      <FormControl>
        <Input
          inputMode="numeric"
          name={name}
          ref={inputRef}
          value={centiOzToInput(value)}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "").slice(0, 9);
            onChange(digits ? Number(digits) : 0);
          }}
          onBlur={onBlur}
        />
      </FormControl>
      <span className="text-sm text-muted-foreground">oz</span>
    </div>
  );
}
/** Peso no formato do Tibia: o usuário digita em oz ("25,5"), o form guarda centi-oz inteiro
 * (2550, igual ao items.xml) e o campo é reformatado para "25.50" ao sair. */
export function WeightField<T extends FieldValues>({
  control,
  name,
  label,
  tooltip,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  tooltip?: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-1.5">
            {label}
            {tooltip && <FieldTooltip text={tooltip} />}
          </FormLabel>
          <OzInput
            value={field.value as number | null | undefined}
            onChange={field.onChange}
            onBlur={field.onBlur}
            name={field.name}
            inputRef={field.ref}
          />
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
