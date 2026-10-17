import { z } from "zod";

/**
 * Campos editáveis de `houses`. O id da house nasce do mapa (RME) e `worldId` é fixo
 * no servidor atual (sempre 0) — nenhum dos dois é editável aqui, por isso não há
 * criação livre pela UI, só moderação/edição das houses que já existem.
 */
export const houseUpdateSchema = z.object({
  name: z.string().min(1, "Informe o nome da house").max(255),
  town: z.number().int().min(0),
  owner: z.number().int().min(0),
  rent: z.number().int().min(0),
  price: z.number().int().min(0),
  size: z.number().int().min(0),
  paid: z.number().int().min(0),
  warnings: z.number().int().min(0),
  guild: z.boolean(),
  clear: z.boolean(),
});

export type HouseUpdateInput = z.infer<typeof houseUpdateSchema>;
