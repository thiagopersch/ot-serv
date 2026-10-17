import { z } from "zod";

export const vocationTypeSchema = z.object({
  name: z.string().min(1, "Informe um nome").max(100),
});

export type VocationTypeInput = z.infer<typeof vocationTypeSchema>;

export const vocationFormulaSchema = z.object({
  meleeDamage: z.number(),
  distDamage: z.number(),
  wandDamage: z.number(),
  magDamage: z.number(),
  magHealingDamage: z.number(),
  defense: z.number(),
  magDefense: z.number(),
  armor: z.number(),
});

export type VocationFormulaInput = z.infer<typeof vocationFormulaSchema>;

export const vocationSkillSchema = z.object({
  fist: z.number(),
  club: z.number(),
  sword: z.number(),
  axe: z.number(),
  distance: z.number(),
  shielding: z.number(),
  fishing: z.number(),
  experience: z.number(),
});

export type VocationSkillInput = z.infer<typeof vocationSkillSchema>;

export const vocationSchema = z.object({
  id: z.number().int().min(0, "O id deve ser >= 0"),
  name: z.string().min(1, "Informe o nome").max(100),
  description: z.string().min(1, "Informe a descrição").max(100),
  needpremium: z.boolean(),
  published: z.boolean(),
  publishedGameplay: z.boolean(),
  gaincap: z.number().int(),
  gainhp: z.number().int(),
  gainmana: z.number().int(),
  gainhpticks: z.number().int(),
  gainhpamount: z.number().int(),
  gainmanaticks: z.number().int(),
  gainmanaamount: z.number().int(),
  manamultiplier: z.number(),
  attackspeed: z.number().int(),
  soulmax: z.number().int(),
  gainsoulticks: z.number().int(),
  fromvoc: z.number().int(),
  typeUniverseId: z.number().int().nullable(),
  lookTypeId: z.number().int().nullable(),
  maxRank: z.number().int().min(0).max(4),
  archetypeId: z.number().int().nullable(),
  specificFragmentItemId: z.number().int().nullable(),
  formula: vocationFormulaSchema,
  skill: vocationSkillSchema,
});

export type VocationInput = z.infer<typeof vocationSchema>;

export const defaultVocationValues: VocationInput = {
  id: 0,
  name: "",
  description: "",
  needpremium: false,
  published: false,
  publishedGameplay: false,
  gaincap: 0,
  gainhp: 0,
  gainmana: 0,
  gainhpticks: 0,
  gainhpamount: 0,
  gainmanaticks: 0,
  gainmanaamount: 0,
  manamultiplier: 1,
  attackspeed: 0,
  soulmax: 0,
  gainsoulticks: 0,
  fromvoc: 0,
  typeUniverseId: null,
  lookTypeId: null,
  maxRank: 0,
  archetypeId: null,
  specificFragmentItemId: null,
  formula: {
    meleeDamage: 1,
    distDamage: 1,
    wandDamage: 1,
    magDamage: 1,
    magHealingDamage: 1,
    defense: 1,
    magDefense: 1,
    armor: 1,
  },
  skill: {
    fist: 1,
    club: 1,
    sword: 1,
    axe: 1,
    distance: 1,
    shielding: 1,
    fishing: 1,
    experience: 1,
  },
};
