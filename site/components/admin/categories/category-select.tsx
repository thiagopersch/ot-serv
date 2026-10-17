"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";
import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import type { Category } from "@/lib/generated/prisma/client";
import type { PaginatedResult } from "@/lib/pagination";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldTooltip } from "@/components/shared/field-tooltip";

/** Select de categoria (compartilhado por Quests/Tasks, ver `/admin/categories`) — busca a
 * lista inteira de uma vez (poucas categorias esperadas, sem paginação/busca incremental). */
export function CategorySelect<T extends FieldValues>({
  control,
  name,
  tooltip,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  tooltip?: string;
}) {
  const { data } = useSWR<PaginatedResult<Category>>("/api/admin/categories?pageSize=200", fetcher);
  const categories = data?.data ?? [];

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-1.5">
            Categoria
            {tooltip && <FieldTooltip text={tooltip} />}
          </FormLabel>
          <Select
            value={field.value != null ? String(field.value) : null}
            onValueChange={(value) => field.onChange(value ? Number(value) : null)}
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione a categoria">
                  {(value: string | null) => {
                    const category = value ? categories.find((c) => String(c.id) === value) : null;
                    if (!category) return "Selecione a categoria";
                    return (
                      <span className="flex items-center gap-2">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                        {category.name}
                      </span>
                    );
                  }}
                </SelectValue>
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={String(category.id)}>
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    {category.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
