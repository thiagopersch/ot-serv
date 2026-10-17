import type { DoodadBrush, Prisma } from "@/lib/generated/prisma/client";
import {
  CARPET_ALIGNS,
  defaultDoodadValues,
  isWallBrushType,
  type CarpetEntryInput,
  type DoodadFormInput,
} from "@/lib/validations/admin/doodad";

/**
 * Guarda no JSON apenas o conteúdo relevante para o `type` do brush — evita
 * persistir listas vazias irrelevantes junto de cada registro.
 */
export function doodadFormToContent(input: DoodadFormInput): Prisma.InputJsonValue {
  if (isWallBrushType(input.type)) {
    return { walls: input.walls };
  }

  switch (input.type) {
    case "doodad":
      return { items: input.items, composites: input.composites, alternates: input.alternates };
    case "carpet":
      return { carpets: input.carpets };
    case "table":
      return { tables: input.tables };
    default:
      return {};
  }
}

export function doodadBrushToFormInput(brush: DoodadBrush): DoodadFormInput {
  const content = (brush.content ?? {}) as Record<string, unknown>;

  return {
    ...defaultDoodadValues,
    name: brush.name,
    type: brush.type as DoodadFormInput["type"],
    serverLookId: brush.serverLookId,
    draggable: brush.draggable,
    onBlocking: brush.onBlocking,
    thickness: brush.thickness,
    onDuplicate: brush.onDuplicate,
    oneSize: brush.oneSize,
    redoBorders: brush.redoBorders,
    reborder: brush.reborder,
    items: (content.items as DoodadFormInput["items"]) ?? [],
    composites: (content.composites as DoodadFormInput["composites"]) ?? [],
    alternates: (content.alternates as DoodadFormInput["alternates"]) ?? [],
    carpets: normalizeCarpets(content.carpets as CarpetEntryInput[] | undefined),
    walls: (content.walls as DoodadFormInput["walls"]) ?? [],
    tables: (content.tables as DoodadFormInput["tables"]) ?? [],
    tilesetCategoryId: brush.tilesetCategoryId,
  };
}

/** Garante os 13 slots fixos de `align`, preenchendo com id=0 os que não estão salvos. */
export function normalizeCarpets(stored: CarpetEntryInput[] | undefined): CarpetEntryInput[] {
  return CARPET_ALIGNS.map((align) => ({
    align,
    id: stored?.find((entry) => entry.align === align)?.id ?? 0,
  }));
}
