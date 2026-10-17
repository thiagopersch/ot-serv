import type { Prisma, WallBrush } from "@/lib/generated/prisma/client";
import {
  defaultWallValues,
  resolveContentMode,
  type FriendInput,
  type WallFormInput,
} from "@/lib/validations/admin/wall";

export function wallFormToContent(input: WallFormInput): Prisma.InputJsonValue {
  if (resolveContentMode(input) === "wall") {
    return { walls: input.walls };
  }

  return { items: input.items, composites: input.composites, alternates: input.alternates };
}

export function wallBrushToFormInput(brush: WallBrush): WallFormInput {
  const content = (brush.content ?? {}) as Record<string, unknown>;
  const friends = (brush.friends ?? []) as FriendInput[];

  return {
    ...defaultWallValues,
    name: brush.name,
    type: brush.type as WallFormInput["type"],
    serverLookId: brush.serverLookId,
    draggable: brush.draggable,
    onBlocking: brush.onBlocking,
    thickness: brush.thickness,
    onDuplicate: brush.onDuplicate,
    oneSize: brush.oneSize,
    redoBorders: brush.redoBorders,
    reborder: brush.reborder,
    walls: (content.walls as WallFormInput["walls"]) ?? [],
    items: (content.items as WallFormInput["items"]) ?? [],
    composites: (content.composites as WallFormInput["composites"]) ?? [],
    alternates: (content.alternates as WallFormInput["alternates"]) ?? [],
    friends: Array.isArray(friends) ? friends : [],
    tilesetCategoryId: brush.tilesetCategoryId,
  };
}
