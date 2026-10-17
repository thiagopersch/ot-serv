import { z } from "zod";

export const BORDER_EDGES = [
  "n",
  "e",
  "s",
  "w",
  "cnw",
  "cne",
  "cse",
  "csw",
  "dnw",
  "dne",
  "dse",
  "dsw",
] as const;
export type BorderEdge = (typeof BORDER_EDGES)[number];

const borderEdgeItemSchema = z.object({
  edge: z.enum(BORDER_EDGES),
  itemId: z.number().int(),
});
export type BorderEdgeItemInput = z.infer<typeof borderEdgeItemSchema>;

export const borderFormSchema = z.object({
  id: z.number().int().min(0, "Informe o id"),
  name: z.string().min(1, "Informe o nome").max(255),
  group: z.number().int().nullable(),
  optional: z.boolean(),
  edges: z.array(borderEdgeItemSchema),
});
export type BorderFormInput = z.infer<typeof borderFormSchema>;

export const defaultBorderEdges: BorderEdgeItemInput[] = BORDER_EDGES.map((edge) => ({
  edge,
  itemId: 0,
}));

export const defaultBorderValues: BorderFormInput = {
  id: 0,
  name: "",
  group: null,
  optional: false,
  edges: defaultBorderEdges,
};

/** Garante os 12 slots fixos de `edge`, preenchendo com itemId=0 os que não estão salvos. */
export function normalizeBorderEdges(stored: BorderEdgeItemInput[] | undefined): BorderEdgeItemInput[] {
  return BORDER_EDGES.map((edge) => ({
    edge,
    itemId: stored?.find((entry) => entry.edge === edge)?.itemId ?? 0,
  }));
}
