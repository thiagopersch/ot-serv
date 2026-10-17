import { z } from "zod";

/**
 * Todos os campos editáveis de `players`, exceto: `id` (PK), `conditions` (blob
 * binário de condições ativas — não dá pra editar via texto sem risco de corromper
 * o personagem) e os campos somente-leitura definidos pelo admin (`lastlogin`,
 * `lastip`, `lastlogout`, `stamina`, `createdAt`).
 */
export const playerUpdateSchema = z.object({
  // Identificação
  name: z.string().min(1, "Informe o nome do personagem").max(255),
  worldId: z.number().int(),
  accountId: z.number().int().min(1, "Informe a conta"),
  groupId: z.number().int().min(1),
  rankId: z.number().int(),
  vocation: z.number().int().min(0),
  sex: z.number().int(),
  level: z.number().int().min(1),
  online: z.number().int(),
  save: z.boolean(),
  deleted: z.number().int().min(0),

  // Vida & recursos
  health: z.number().int(),
  healthmax: z.number().int().min(1),
  mana: z.number().int(),
  manamax: z.number().int(),
  cap: z.number().int(),
  soul: z.number().int(),
  maglevel: z.number().int(),
  // BigInt no banco — representados como number no form (seguro até 2^53).
  experience: z.number().int().min(0),
  manaspent: z.number().int().min(0),
  resets: z.number().int(),
  skillPoints: z.number().int(),

  // Posição
  townId: z.number().int(),
  posx: z.number().int(),
  posy: z.number().int(),
  posz: z.number().int(),
  direction: z.number().int(),

  // Skills
  healthSkill: z.number().int(),
  manaSkill: z.number().int(),
  bendSkill: z.number().int(),
  dodgeSkill: z.number().int(),
  dodge: z.number().int(),
  critical: z.number().int(),

  // Perdas & PVP
  lossExperience: z.number().int(),
  lossMana: z.number().int(),
  lossSkills: z.number().int(),
  lossContainers: z.number().int(),
  lossItems: z.number().int(),
  skull: z.number().int(),
  skulltime: z.number().int(),
  blessings: z.number().int(),
  marriage: z.number().int(),
  promotion: z.number().int(),

  // Aparência (outfit)
  lookbody: z.number().int(),
  lookfeet: z.number().int(),
  lookhead: z.number().int(),
  looklegs: z.number().int(),
  looktype: z.number().int(),
  lookaddons: z.number().int(),
  lookmount: z.number().int(),
  lookwings: z.number().int(),
  lookaura: z.number().int(),
  lookshader: z.number().int(),
  lookhealthbar: z.number().int(),
  lookmanabar: z.number().int(),

  // Guild & Cast
  guildnick: z.string().max(255),
  cast: z.number().int(),
  castViewers: z.number().int(),
  castDescription: z.string().max(255),

  // Vocações desbloqueadas — lista de ids (players.unlocked_vocations = "1,5,12")
  unlockedVocations: z.array(z.number().int()),

  // Outros
  balance: z.number().int(),
  premend: z.number().int(),
  description: z.string().max(255),
  age: z.number().int(),
  ageMinutes: z.number().int(),
  onlineTime: z.number().int(),
});

export type PlayerUpdateInput = z.infer<typeof playerUpdateSchema>;
