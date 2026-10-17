import type { Ground } from "@/lib/generated/prisma/client";
import { defaultGroundValues, type GroundFormInput } from "@/lib/validations/admin/ground";

export function groundToFormInput(ground: Ground): GroundFormInput {
  return {
    ...defaultGroundValues,
    name: ground.name,
    serverLookId: ground.serverLookId,
    zOrder: ground.zOrder,
    soloOptional: ground.soloOptional,
    items: (ground.items as GroundFormInput["items"]) ?? [],
    borders: (ground.borders as GroundFormInput["borders"]) ?? [],
    friends: (ground.friends as GroundFormInput["friends"]) ?? [],
    tilesetCategoryId: ground.tilesetCategoryId,
  };
}
