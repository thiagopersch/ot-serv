"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { useController } from "react-hook-form";

export type MultiCheckboxOption = { value: number; label: string };

type MultiCheckboxFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  options: MultiCheckboxOption[];
  emptyLabel?: string;
};

/**
 * Multiselect em formato de lista de checkboxes — o campo do form guarda `number[]`.
 * Usado para relações "muitos" simples (ex.: `unlockedVocations`) sem precisar de um
 * combobox de chips.
 */
export function MultiCheckboxField<T extends FieldValues>({
  control,
  name,
  options,
  emptyLabel = "Nenhuma opção disponível.",
}: MultiCheckboxFieldProps<T>) {
  const { field } = useController({ control, name });
  const selected: number[] = Array.isArray(field.value) ? field.value : [];

  function toggle(value: number, checked: boolean) {
    if (checked) {
      field.onChange([...selected, value]);
    } else {
      field.onChange(selected.filter((v) => v !== value));
    }
  }

  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="grid max-h-64 gap-1.5 overflow-y-auto rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-3">
      {options.map((option) => (
        <label
          key={option.value}
          className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted"
        >
          <input
            type="checkbox"
            className="size-4"
            checked={selected.includes(option.value)}
            onChange={(event) => toggle(option.value, event.target.checked)}
          />
          <span className="truncate">
            {option.value} — {option.label}
          </span>
        </label>
      ))}
    </div>
  );
}
