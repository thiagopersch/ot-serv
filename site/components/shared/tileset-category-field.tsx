"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { useController } from "react-hook-form";
import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import { FormControl, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

type CategoryOption = {
  id: number;
  label: string;
};

type CategoryApiResult = {
  categories: { id: number; label: string }[];
};

/** `terrain` -> categorias de Ground/Wall (`TERRAIN`/`TERRAIN_AND_RAW`); `doodad` ->
 * qualquer categoria BRUSH (terrain ou doodad) — o RME já mistura brushes de
 * doodads.xml dentro de tags `terrain`/`terrain_and_raw` (ex.: tileset "City Carpets"
 * do arquivo de referência), então um DoodadBrush pode ser categorizado em qualquer
 * uma. Reflete `assertCategoryKindMatchesBrushKind` em `lib/tileset-integrity.ts`. */
const KIND_QUERY: Record<"terrain" | "doodad", string> = {
  terrain: "TERRAIN,TERRAIN_AND_RAW",
  doodad: "TERRAIN,TERRAIN_AND_RAW,DOODAD,DOODAD_AND_RAW",
};

type TilesetCategoryFieldProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  brushKind: "terrain" | "doodad";
  required?: boolean;
};

/** Combobox "Categoria do Tileset" reutilizado pelos forms de Ground/Wall (brushKind
 * "terrain") e Doodad (brushKind "doodad") — só lista categorias do tipo BRUSH
 * compatíveis, já que categorias ITEM não fazem sentido para esses CRUDs. */
export function TilesetCategoryField<TFieldValues extends FieldValues>({
  control,
  name,
  brushKind,
  required = true,
}: TilesetCategoryFieldProps<TFieldValues>) {
  const { field } = useController({ control, name });

  const { data } = useSWR<CategoryApiResult>(
    `/api/admin/tilesets/categories?type=BRUSH&kind=${KIND_QUERY[brushKind]}`,
    fetcher
  );

  const options: CategoryOption[] = data?.categories ?? [];
  const selected = options.find((option) => option.id === field.value) ?? null;

  return (
    <FormItem>
      <FormLabel>
        Categoria do Tileset{required ? " *" : ""}
      </FormLabel>
      <Combobox
        items={options}
        value={selected}
        onValueChange={(item) => field.onChange((item as CategoryOption | null)?.id ?? null)}
        isItemEqualToValue={(a: CategoryOption, b: CategoryOption) => a.id === b.id}
        itemToStringLabel={(item: CategoryOption) => item.label}
      >
        <FormControl>
          <ComboboxInput placeholder="Buscar categoria por tileset ou nome..." className="w-full" showClear />
        </FormControl>
        <ComboboxContent>
          <ComboboxEmpty>Nenhuma categoria encontrada. Crie uma em /admin/tilesets.</ComboboxEmpty>
          <ComboboxList>
            {(item: CategoryOption) => (
              <ComboboxItem key={item.id} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <FormMessage />
    </FormItem>
  );
}
