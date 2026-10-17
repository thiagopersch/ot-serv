"use client";

import type { Control, FieldPath } from "react-hook-form";
import { useController } from "react-hook-form";

import type { GroundFormInput } from "@/lib/validations/admin/ground";
import { FormControl, FormItem, FormLabel } from "@/components/ui/form";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

export type BorderOption = { value: number; label: string };

type GroundBorderComboboxProps = {
  control: Control<GroundFormInput>;
  name: FieldPath<GroundFormInput>;
  options: BorderOption[];
};

export function GroundBorderCombobox({ control, name, options }: GroundBorderComboboxProps) {
  const { field } = useController({ control, name });
  const selected = options.find((option) => option.value === field.value) ?? null;

  return (
    <FormItem>
      <FormLabel>Border</FormLabel>
      <Combobox
        items={options}
        value={selected}
        onValueChange={(item) => field.onChange((item as BorderOption | null)?.value ?? 0)}
        isItemEqualToValue={(a: BorderOption, b: BorderOption) => a.value === b.value}
        itemToStringLabel={(item: BorderOption) => item.label}
      >
        <FormControl>
          <ComboboxInput placeholder="Buscar border por nome ou id..." className="w-64" />
        </FormControl>
        <ComboboxContent>
          <ComboboxEmpty>Nenhum border encontrado.</ComboboxEmpty>
          <ComboboxList>
            {(item: BorderOption) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </FormItem>
  );
}
