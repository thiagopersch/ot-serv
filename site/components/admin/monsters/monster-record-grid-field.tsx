"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { NumberField } from "@/components/shared/number-field";

type MonsterRecordGridFieldProps<T extends FieldValues> = {
  control: Control<T>;
  basePath: string;
  keys: readonly string[];
  labels?: Record<string, string>;
};

/** Grade fixa de campos numéricos para `immunities`/`elements` (chaves conhecidas de antemão). */
export function MonsterRecordGridField<T extends FieldValues>({
  control,
  basePath,
  keys,
  labels,
}: MonsterRecordGridFieldProps<T>) {
  return (
    <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {keys.map((key) => (
        <NumberField
          key={key}
          control={control}
          name={`${basePath}.${key}` as FieldPath<T>}
          label={labels?.[key] ?? key}
        />
      ))}
    </div>
  );
}
