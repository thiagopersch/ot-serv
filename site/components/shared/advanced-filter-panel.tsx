"use client";

import { ChevronDown, Filter, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type FilterFieldOption = { value: string; label: string };

/**
 * Descreve um campo de filtro avançado de forma genérica — cada página monta seu
 * próprio array de `FilterFieldConfig` (ex.: vocations = classe/universo/premium,
 * monsters = tipo/universo/subcategoria/race/faixa de exp/HP/loot/attacks/looktype),
 * sem precisar tocar no componente de tabela ou no painel em si.
 */
export type FilterFieldConfig = {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "multi-select";
  placeholder?: string;
  options?: FilterFieldOption[];
};

export type FilterValues = Record<string, string>;

/** Filtro de múltipla escolha — valor guardado como lista separada por vírgula na mesma
 * `FilterValues` (string), sem exigir mudanças no `useServerTable`/`buildQueryParams`. */
function MultiSelectFilterField({
  field,
  value,
  onChange,
}: {
  field: FilterFieldConfig;
  value: string;
  onChange: (value: string) => void;
}) {
  const selectedValues = value ? value.split(",").filter(Boolean) : [];
  const options = field.options ?? [];

  function toggleOption(optionValue: string) {
    if (selectedValues.includes(optionValue)) {
      onChange(selectedValues.filter((v) => v !== optionValue).join(","));
    } else {
      onChange([...selectedValues, optionValue].join(","));
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{field.label}</Label>
      <details className="group rounded-md border border-input">
        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm">
          <span>
            {selectedValues.length === 0
              ? (field.placeholder ?? "Todos")
              : `${selectedValues.length} selecionado(s)`}
          </span>
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="max-h-48 overflow-auto border-t p-2">
          {options.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">Nenhuma opção disponível.</p>
          )}
          {options.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
            >
              <input
                type="checkbox"
                className="size-4"
                checked={selectedValues.includes(option.value)}
                onChange={() => toggleOption(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}

function FilterField({
  field,
  value,
  onChange,
}: {
  field: FilterFieldConfig;
  value: string;
  onChange: (value: string) => void;
}) {
  if (field.type === "multi-select") {
    return <MultiSelectFilterField field={field} value={value} onChange={onChange} />;
  }

  if (field.type === "select") {
    const allLabel = field.placeholder ?? "Todos";
    const labelOf = (v: string) =>
      v === "__all__" || !v ? allLabel : (field.options?.find((option) => option.value === v)?.label ?? v);

    return (
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">{field.label}</Label>
        <Select
          value={value || "__all__"}
          onValueChange={(v) => onChange(!v || v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue>{(v: string) => labelOf(v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            {field.options?.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{field.label}</Label>
      <Input
        type={field.type === "number" ? "number" : "text"}
        placeholder={field.placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function AdvancedFilterPanel({
  fields,
  values,
  onValuesChange,
  onApply,
  onClear,
  isFiltering,
}: {
  fields: FilterFieldConfig[];
  values: FilterValues;
  onValuesChange: (values: FilterValues) => void;
  onApply: () => void;
  onClear: () => void;
  isFiltering?: boolean;
}) {
  function setFieldValue(key: string, value: string) {
    onValuesChange({ ...values, [key]: value });
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border bg-muted/20 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {fields.map((field) => (
          <FilterField
            key={field.key}
            field={field}
            value={values[field.key] ?? ""}
            onChange={(value) => setFieldValue(field.key, value)}
          />
        ))}
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClear} disabled={isFiltering}>
          <X className="size-4" />
          Limpar filtros
        </Button>
        <Button type="button" size="sm" onClick={onApply} disabled={isFiltering}>
          <Filter className="size-4" />
          {isFiltering ? "Filtrando..." : "Filtrar"}
        </Button>
      </div>
    </div>
  );
}
