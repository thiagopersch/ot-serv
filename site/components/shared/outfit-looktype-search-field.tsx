"use client";

import { useController, type Control, type FieldPath, type FieldValues } from "react-hook-form";

import { formatLooktypeOption } from "@/lib/validations/admin/looktype";
import { FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { EntitySearchCombobox } from "@/components/shared/entity-search-combobox";
import { LooktypeThumbById } from "@/components/shared/looktype-thumb-by-id";
import { LooktypeAnimatedImage } from "@/components/shared/looktype-animated-image";

export type OutfitLooktypeOption = {
  id: number;
  name: string;
  looktypeNumber: number | null;
  frameCount: number;
  frameDurationsMs: number[];
  updatedAt: string;
};

/** Opção do combobox de looktype com a miniatura animada da sprite + o label padrão. */
export function renderLooktypeOption(looktype: OutfitLooktypeOption) {
  return (
    <span className="flex items-center gap-2">
      <LooktypeAnimatedImage
        looktypeId={looktype.id}
        frameCount={looktype.frameCount}
        frameDurationsMs={looktype.frameDurationsMs}
        updatedAt={looktype.updatedAt}
        size="sm"
        zoomOnHover={false}
      />
      {formatLooktypeOption(looktype)}
    </span>
  );
}

type OutfitLooktypeSearchFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  disabled?: boolean;
  /** Avisa a linha escolhida (ex.: para atualizar o número no preview do XML). */
  onLooktypeChange?: (looktype: OutfitLooktypeOption | null) => void;
};

/** Campo RHF (valor = `looktypes.id`) com busca no cadastro de looktypes filtrado por
 * category="outfit" — busca por nome, id ou número da looktype. */
export function OutfitLooktypeSearchField<T extends FieldValues>({
  control,
  name,
  label,
  disabled,
  onLooktypeChange,
}: OutfitLooktypeSearchFieldProps<T>) {
  const { field } = useController({ control, name });
  const rawValue = field.value as number | null | undefined;
  const looktypeId = typeof rawValue === "number" && rawValue > 0 ? rawValue : null;

  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <div className="flex items-center gap-2">
        <div className={`flex-1 ${disabled ? "pointer-events-none opacity-60" : ""}`}>
          <EntitySearchCombobox<OutfitLooktypeOption>
            endpoint="/api/admin/looktypes?category=outfit"
            value={looktypeId}
            placeholder="Buscar looktype por nome ou número..."
            formatOption={formatLooktypeOption}
            renderOption={renderLooktypeOption}
            onSelect={(looktype) => {
              field.onChange(looktype?.id ?? 0);
              onLooktypeChange?.(looktype);
            }}
          />
        </div>
        {looktypeId != null && <LooktypeThumbById key={looktypeId} looktypeId={looktypeId} size="md" />}
      </div>
      <FormMessage />
    </FormItem>
  );
}
