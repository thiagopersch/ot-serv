import type { Border } from "@/lib/generated/prisma/client";
import {
  normalizeBorderEdges,
  type BorderEdgeItemInput,
  type BorderFormInput,
} from "@/lib/validations/admin/border";

export function borderToFormInput(border: Border): BorderFormInput {
  return {
    id: border.id,
    name: border.name,
    group: border.group,
    optional: border.optional,
    edges: normalizeBorderEdges(border.edges as BorderEdgeItemInput[] | undefined),
  };
}
