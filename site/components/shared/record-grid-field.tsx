"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { NumberField } from "@/components/shared/number-field";

type RecordGridFieldProps<T extends FieldValues> = {
  control: Control<T>;
  basePath: string;
  keys: readonly string[];
  labels?: Record<string, string>;
  /** Texto do (i) ao lado de cada campo, por chave. */
  tooltips?: Record<string, string>;
};

/** Grade fixa de campos numéricos para grupos JSON tipo `Record<string, number>` (chaves
 * conhecidas de antemão) — generalização de `monster-record-grid-field.tsx` para qualquer
 * entidade (usado pelos grupos elements/absorbPercent/reflectPercent/... do Item). */
export function RecordGridField<T extends FieldValues>({
  control,
  basePath,
  keys,
  labels,
  tooltips,
}: RecordGridFieldProps<T>) {
  return (
    <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {keys.map((key) => (
        <NumberField
          key={key}
          control={control}
          name={`${basePath}.${key}` as FieldPath<T>}
          label={labels?.[key] ?? key}
          tooltip={tooltips?.[key]}
        />
      ))}
    </div>
  );
}
