import type { Town } from "@/lib/generated/prisma/client";
import type { TownFormInput } from "@/lib/validations/admin/town";

export function townToFormInput(town: Town): TownFormInput {
  return {
    id: town.id,
    name: town.name,
    templeX: town.templeX,
    templeY: town.templeY,
    templeZ: town.templeZ,
    published: town.published,
  };
}
