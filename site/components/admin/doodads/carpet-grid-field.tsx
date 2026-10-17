"use client";

import type { Control, FieldPath } from "react-hook-form";

import { CARPET_ALIGNS, type DoodadFormInput } from "@/lib/validations/admin/doodad";
import { NumberField } from "@/components/shared/number-field";

type CarpetGridFieldProps = {
  control: Control<DoodadFormInput>;
};

const ALIGN_LABELS: Record<(typeof CARPET_ALIGNS)[number], string> = {
  n: "Norte (n)",
  e: "Leste (e)",
  s: "Sul (s)",
  w: "Oeste (w)",
  cnw: "Canto côncavo NO (cnw)",
  cne: "Canto côncavo NE (cne)",
  cse: "Canto côncavo SE (cse)",
  csw: "Canto côncavo SO (csw)",
  dnw: "Canto diagonal NO (dnw)",
  dne: "Canto diagonal NE (dne)",
  dse: "Canto diagonal SE (dse)",
  dsw: "Canto diagonal SO (dsw)",
  center: "Centro (center)",
};

export function CarpetGridField({ control }: CarpetGridFieldProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {CARPET_ALIGNS.map((align, index) => (
        <NumberField
          key={align}
          control={control}
          name={`carpets.${index}.id` as FieldPath<DoodadFormInput>}
          label={`${ALIGN_LABELS[align]} — item ID`}
        />
      ))}
    </div>
  );
}
