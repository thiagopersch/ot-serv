"use client";

import { useController, type Control, type FieldPath, type FieldValues } from "react-hook-form";

import { FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { EntitySearchCombobox } from "@/components/shared/entity-search-combobox";
import { EntityThumb } from "@/components/shared/entity-thumb";
import { FieldTooltip } from "@/components/shared/field-tooltip";

type ItemRow = { id: number; name: string };

type ItemSearchFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label?: string;
  placeholder?: string;
  tooltip?: string;
};

/** Campo de item id com busca por nome/id (cadastro de item) + preview da looktype vinculada
 * lá no cadastro — substitui `ItemIdField` (input numérico puro) nos CRUDs que vinculam item
 * por id (Grounds, Walls, Doodads, Composites/Alternates, ...). */
export function ItemSearchField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder = "Buscar item por nome ou id...",
  tooltip,
}: ItemSearchFieldProps<T>) {
  const { field } = useController({ control, name });
  const rawValue = field.value as number | null | undefined;
  const itemId = typeof rawValue === "number" && rawValue > 0 ? rawValue : null;

  return (
    <FormItem>
      {label && (
        <FormLabel className="flex items-center gap-1.5">
          {label}
          {tooltip && <FieldTooltip text={tooltip} />}
        </FormLabel>
      )}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <EntitySearchCombobox<ItemRow>
            endpoint="/api/admin/items"
            value={itemId}
            placeholder={placeholder}
            formatOption={(item) => `${item.name} (#${item.id})`}
            renderOption={(item) => (
              <span className="flex items-center gap-2">
                <EntityThumb entityType="item" id={item.id} name={item.name} size="32" />
                {item.name} (#{item.id})
              </span>
            )}
            onSelect={(item) => field.onChange(item?.id ?? 0)}
          />
        </div>
        {itemId != null && <EntityThumb entityType="item" id={itemId} size="32" />}
      </div>
      <FormMessage />
    </FormItem>
  );
}
