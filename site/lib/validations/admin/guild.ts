import { z } from "zod";

/** Rank da guild — `id` ausente/undefined = nova entrada (ainda não existe no banco). */
export const guildRankInputSchema = z.object({
  id: z.number().int().optional(),
  name: z.string().min(1, "Informe o nome do rank").max(255),
  level: z.number().int().min(0),
});

/**
 * Campos editáveis de `guilds`. O id nasce da criação in-game pelo player (comando de
 * fundar guild) — não há criação livre pela UI, só moderação: reatribuir dono, editar
 * motd/nome e gerenciar os ranks já existentes.
 */
export const guildUpdateSchema = z.object({
  name: z.string().min(1, "Informe o nome da guild").max(255),
  motd: z.string().max(255),
  ownerId: z.number().int().min(1, "Informe o dono"),
  ranks: z.array(guildRankInputSchema),
});

export type GuildRankInput = z.infer<typeof guildRankInputSchema>;
export type GuildUpdateInput = z.infer<typeof guildUpdateSchema>;
