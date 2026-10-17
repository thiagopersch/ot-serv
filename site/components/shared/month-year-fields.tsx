"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

type MonthYearFieldsProps<T extends FieldValues> = {
  control: Control<T>;
  yearName: FieldPath<T>;
  monthName: FieldPath<T>;
  disabled?: boolean;
};

/** Par de campos Ano/Mês reutilizado em Battle Pass e Daily Rewards: Ano é texto livre limitado
 * a 4 dígitos, Mês lista os nomes mas salva o número (1-12). */
export function MonthYearFields<T extends FieldValues>({
  control,
  yearName,
  monthName,
  disabled,
}: MonthYearFieldsProps<T>) {
  return (
    <>
      <FormField
        control={control}
        name={yearName}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Ano</FormLabel>
            <FormControl>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={4}
                disabled={disabled}
                name={field.name}
                ref={field.ref}
                onBlur={field.onBlur}
                value={(field.value as number | string) ?? ""}
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, "").slice(0, 4);
                  field.onChange(digits === "" ? 0 : Number(digits));
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name={monthName}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Mês</FormLabel>
            <Select
              value={field.value ? String(field.value) : undefined}
              onValueChange={(value) => field.onChange(Number(value))}
              disabled={disabled}
            >
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o mês" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {MONTH_NAMES.map((name, index) => (
                  <SelectItem key={name} value={String(index + 1)}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}

export const CURRENT_YEAR = new Date().getFullYear();
