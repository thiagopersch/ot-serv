"use client";

import { useState, type CSSProperties } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { getOutfitPaletteColor } from "@/lib/tibia-outfit-color";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FieldTooltip } from "@/components/shared/field-tooltip";
import { cn } from "@/lib/utils";

const PALETTE_SIZE = 133;
const HUES_PER_ROW = 19;

function swatchStyle(index: number): CSSProperties {
  const rgb = getOutfitPaletteColor(index);
  return { backgroundColor: rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : "transparent" };
}

type TibiaColorPickerFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label?: string;
  tooltip?: string;
};

/** Cor do outfit (0-132) com input numérico + botão que abre a paleta real do Tibia (19 matizes
 * x 7 intensidades, ver `lib/tibia-outfit-color.ts`) pra escolher visualmente em vez de decorar
 * índices. */
export function TibiaColorPickerField<T extends FieldValues>({
  control,
  name,
  label,
  tooltip,
}: TibiaColorPickerFieldProps<T>) {
  const [open, setOpen] = useState(false);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const value = typeof field.value === "number" ? field.value : 0;

        function setValue(next: number) {
          field.onChange(Math.max(0, Math.min(PALETTE_SIZE - 1, next)));
          setOpen(false);
        }

        return (
          <FormItem>
            {label && (
              <FormLabel className="flex items-center gap-1.5">
                {label}
                {tooltip && <FieldTooltip text={tooltip} />}
              </FormLabel>
            )}
            <div className="flex items-center gap-1.5">
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  max={PALETTE_SIZE - 1}
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  value={value}
                  onChange={(event) => setValue(event.target.value === "" ? 0 : Number(event.target.value))}
                />
              </FormControl>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      title="Escolher cor"
                      className="size-9 shrink-0 rounded-md border border-input"
                      style={swatchStyle(value)}
                    />
                  }
                />
                <PopoverContent className="w-auto p-2" side="bottom" align="start">
                  <div
                    className="grid gap-0.5"
                    style={{ gridTemplateColumns: `repeat(${HUES_PER_ROW}, minmax(0, 1fr))` }}
                  >
                    {Array.from({ length: PALETTE_SIZE }, (_, index) => (
                      <button
                        key={index}
                        type="button"
                        title={`Cor ${index}`}
                        onClick={() => setValue(index)}
                        className={cn(
                          "size-4 rounded-[2px] border border-border/50",
                          value === index && "ring-2 ring-primary ring-offset-1 ring-offset-popover",
                        )}
                        style={swatchStyle(index)}
                      />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
