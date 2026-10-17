"use client";

import { useFieldArray, useWatch, type Control, type FieldPath } from "react-hook-form";
import { Plus } from "lucide-react";

import {
  GROUND_BORDER_ALIGNS,
  emptyGroundBorderRef,
  type GroundFormInput,
} from "@/lib/validations/admin/ground";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GroundBorderCombobox, type BorderOption } from "@/components/admin/grounds/ground-border-combobox";
import { CollapsibleFieldCard } from "@/components/shared/collapsible-field-card";
import { EntityThumb } from "@/components/shared/entity-thumb";
import type { BorderEdgeItemInput } from "@/lib/validations/admin/border";

type GroundBorderListFieldProps = {
  control: Control<GroundFormInput>;
  borderOptions: BorderOption[];
  /** Edges de cada border já carregada — pra mostrar a looktype vinculada ao lado do select. */
  bordersById: Map<number, BorderEdgeItemInput[]>;
};

export function GroundBorderListField({ control, borderOptions, bordersById }: GroundBorderListFieldProps) {
  const { fields, append, remove } = useFieldArray({ control, name: "borders" });

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Borders (align/id do border)</span>
      {fields.map((field, index) => (
        <GroundBorderRow
          key={field.id}
          control={control}
          index={index}
          borderOptions={borderOptions}
          bordersById={bordersById}
          onRemove={() => remove(index)}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => append(emptyGroundBorderRef)}
      >
        <Plus className="size-4" />
        Adicionar border
      </Button>
    </div>
  );
}

function GroundBorderRow({
  control,
  index,
  borderOptions,
  bordersById,
  onRemove,
}: {
  control: Control<GroundFormInput>;
  index: number;
  borderOptions: BorderOption[];
  bordersById: Map<number, BorderEdgeItemInput[]>;
  onRemove: () => void;
}) {
  const borderId = useWatch({ control, name: `borders.${index}.borderId` as FieldPath<GroundFormInput> }) as
    | number
    | undefined;
  const edges = borderId ? (bordersById.get(borderId) ?? []) : [];
  const previewItemIds = edges.map((edge) => edge.itemId).filter((id) => id > 0).slice(0, 4);

  return (
    <CollapsibleFieldCard title={`Border #${index + 1}`} onRemove={onRemove}>
      <div className="flex flex-wrap items-end gap-2">
        <FormField
          control={control}
          name={`borders.${index}.align` as FieldPath<GroundFormInput>}
          render={({ field: selectField }) => (
            <FormItem>
              <FormLabel>Align</FormLabel>
              <Select value={String(selectField.value)} onValueChange={(value) => selectField.onChange(value)}>
                <FormControl>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {GROUND_BORDER_ALIGNS.map((align) => (
                    <SelectItem key={align} value={align}>
                      {align}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        <GroundBorderCombobox
          control={control}
          name={`borders.${index}.borderId` as FieldPath<GroundFormInput>}
          options={borderOptions}
        />

        {previewItemIds.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Looktypes vinculadas</span>
            <div className="flex gap-1">
              {previewItemIds.map((itemId) => (
                <EntityThumb key={itemId} entityType="item" id={itemId} size="32" />
              ))}
            </div>
          </div>
        )}

        <FormField
          control={control}
          name={`borders.${index}.to` as FieldPath<GroundFormInput>}
          render={({ field: toField }) => (
            <FormItem>
              <FormLabel>To (opcional: nome, &quot;none&quot;, &quot;all&quot;)</FormLabel>
              <FormControl>
                <Input
                  className="w-56"
                  value={String(toField.value ?? "")}
                  onChange={(event) => toField.onChange(event.target.value === "" ? null : event.target.value)}
                />
              </FormControl>
            </FormItem>
          )}
        />
      </div>
    </CollapsibleFieldCard>
  );
}
