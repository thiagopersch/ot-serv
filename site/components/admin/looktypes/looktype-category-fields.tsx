"use client";

import { LOOKTYPE_CATEGORIES, LOOKTYPE_CATEGORY_LABELS, type LooktypeCategory } from "@/lib/validations/admin/looktype";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type LooktypeCategoryFieldsProps = {
  category: LooktypeCategory;
  onCategoryChange: (category: LooktypeCategory) => void;
  looktypeNumber: number | null;
  onLooktypeNumberChange: (value: number | null) => void;
};

/** Select de tipo (item/outfit/effect/missile) + campo de número condicional — number some
 * quando category = "item" (item usa o clientId do próprio items.xml, não essa numeração). */
export function LooktypeCategoryFields({
  category,
  onCategoryChange,
  looktypeNumber,
  onLooktypeNumberChange,
}: LooktypeCategoryFieldsProps) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label>Tipo</Label>
        <Select value={category} onValueChange={(value) => onCategoryChange(value as LooktypeCategory)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione o tipo" />
          </SelectTrigger>
          <SelectContent>
            {LOOKTYPE_CATEGORIES.map((option) => (
              <SelectItem key={option} value={option}>
                {LOOKTYPE_CATEGORY_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {category !== "item" && (
        <div className="flex flex-col gap-1.5">
          <Label>Número da sprite listada no Object Builder</Label>
          <Input
            type="number"
            value={looktypeNumber ?? ""}
            onChange={(event) =>
              onLooktypeNumberChange(event.target.value === "" ? null : Number(event.target.value))
            }
          />
        </div>
      )}
    </>
  );
}
