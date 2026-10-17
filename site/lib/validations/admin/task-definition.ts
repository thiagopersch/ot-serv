import { z } from "zod";

import { TASK_DIFFICULTIES } from "@/lib/task-difficulty";
import { TASK_TYPES } from "@/lib/task-type";

/** Gera o identificador (slug) da task a partir do Nome: sempre com o prefixo `task_`,
 * minúsculas, sem acentos/pontuação, palavras separadas por underline. Usado para preencher o
 * campo Identificador ao vivo enquanto o admin digita o Nome — ele fica sempre `disabled` no
 * formulário (ver comentário do model `TaskDefinition.id` no schema: não deve mudar depois de
 * criada, quebraria `player_tasks.task_id`). */
export function nameToTaskSlug(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `task_${slug}`;
}

export const taskMonsterSchema = z.object({
  name: z.string().min(1, "Selecione um monstro"),
  kills: z.number().int().min(1),
});

export const taskRewardItemSchema = z.object({
  itemId: z.number().int().min(1, "Selecione um item"),
  count: z.number().int().min(1),
});

export const taskDefinitionSchema = z.object({
  id: z
    .string()
    .min(1, "Informe o identificador")
    .max(50)
    .regex(/^[a-z0-9_-]+$/, "Use apenas letras minúsculas, números, hífen e underscore"),
  name: z.string().min(1, "Informe o nome").max(255),
  lookType: z.number().int().min(0),
  categoryId: z.number().int().min(1, "Selecione uma categoria"),
  type: z.enum(TASK_TYPES, { message: "Selecione um tipo" }),
  difficulty: z.enum(TASK_DIFFICULTIES, { message: "Selecione uma dificuldade" }),
  levelRequired: z.number().int().min(0),
  rankRequired: z.number().int().min(0),
  killsRequired: z.number().int().min(0),
  points: z.number().int().min(0),
  experience: z.number().int().min(0),
  money: z.number().int().min(0),
  published: z.boolean(),
  monsters: z.array(taskMonsterSchema).min(1, "Adicione ao menos um monstro"),
  rewardItems: z.array(taskRewardItemSchema),
  deliveryEnabled: z.boolean(),
  deliveryItemId: z.number().int().min(0),
  deliveryCount: z.number().int().min(0),
  postId: z.number().int().nullable(),
});

export type TaskDefinitionInput = z.infer<typeof taskDefinitionSchema>;

export const defaultTaskDefinitionValues: TaskDefinitionInput = {
  id: "",
  name: "",
  lookType: 0,
  categoryId: 0,
  type: "kill",
  difficulty: "easy",
  levelRequired: 0,
  rankRequired: 0,
  killsRequired: 0,
  points: 0,
  experience: 0,
  money: 0,
  published: true,
  monsters: [],
  rewardItems: [],
  deliveryEnabled: false,
  deliveryItemId: 0,
  deliveryCount: 0,
  postId: null,
};

type TaskMonster = z.infer<typeof taskMonsterSchema>;
type TaskMonsterDetail = {
  name: string;
  level: number;
  size: string;
  location: string;
  probability: number;
};

/** O servidor (`task_network.lua: task.category == category or task.category == "general"`)
 * só reconhece as strings literais "dragonball" | "bleach" | "general" — vindas do universo da
 * vocação do jogador (`task_rank.lua: TaskRank_getPlayerVocationCategory`, lido de
 * `type_universe` em `vocations.xml`). O select de Categoria no CRUD usa o modelo genérico
 * `Category` (compartilhado com Posts/Quests, nome livre) só pra fins de organização/ordenação
 * da listagem — normaliza aqui pra garantir que a task fique visível no jogo mesmo que o nome
 * da categoria esteja em outra grafia (ex.: "Dragon Ball" -> "dragonball"). Se o nome não
 * corresponder a nenhum dos 3 universos, a task fica com uma categoria que o servidor nunca
 * bate — cadastre a `Category` com um desses nomes (dragonball/bleach/general, exceto acentos e
 * espaços) para a task aparecer no módulo game_tasks do cliente. */
export function normalizeTaskCategory(categoryName: string): string {
  return categoryName.trim().toLowerCase().replace(/\s+/g, "");
}

/** Únicos valores que `task_rank.lua: TaskRank_getPlayerVocationCategory` (via `type_universe`
 * em vocations.xml) e `task_network.lua` podem produzir/comparar. Uma `Category` que não
 * normalize para um destes deixa a task com uma categoria que o servidor nunca bate — a task
 * fica cadastrada, mas invisível no `game_tasks` do cliente para todo mundo, silenciosamente. */
export const TASK_VALID_UNIVERSES = ["dragonball", "bleach", "general"] as const;

export function isValidTaskUniverse(normalizedCategory: string): boolean {
  return (TASK_VALID_UNIVERSES as readonly string[]).includes(normalizedCategory);
}

/** Payload que vai pro Prisma (colunas JSON) a partir dos campos "achatados" do formulário.
 * `categoryName` resolve `categoryId` -> `category` (string denormalizada que o
 * `task_db_loader.lua` lê — nunca fica dessincronizada, ver `/api/admin/categories`). */
export function taskDefinitionInputToRow(input: TaskDefinitionInput, categoryName: string) {
  const { categoryId, rewardItems, deliveryEnabled, deliveryItemId, deliveryCount, monsters, ...rest } = input;

  return {
    ...rest,
    categoryId,
    category: normalizeTaskCategory(categoryName),
    monsters,
    rewards: { items: rewardItems.map((item) => [item.itemId, item.count]) },
    delivery: deliveryEnabled
      ? { enabled: true, itemId: deliveryItemId, count: deliveryCount }
      : { enabled: false },
    monsterDetails: monsters.map(
      (monster: TaskMonster): TaskMonsterDetail => ({
        name: monster.name,
        level: 0,
        size: "Unknown",
        location: "Unknown",
        probability: 0,
      }),
    ),
  };
}

type TaskDefinitionRow = {
  id: string;
  name: string;
  lookType: number;
  categoryId: number | null;
  type: string;
  difficulty: string;
  levelRequired: number;
  rankRequired: number;
  killsRequired: number;
  points: number;
  experience: number;
  money: number;
  published: boolean;
  monsters: unknown;
  rewards: unknown;
  delivery: unknown;
  postId: number | null;
};

/** Inverso de `taskDefinitionInputToRow` — reconstrói os campos "achatados" do formulário a
 * partir de uma linha do banco (colunas JSON). Compartilhado pela listagem e pela página de
 * edição (`/admin/tasks/[id]`). */
export function taskDefinitionRowToInput(row: TaskDefinitionRow): TaskDefinitionInput {
  const monsters = (row.monsters as { name: string; kills: number }[] | null) ?? [];
  const rewards = (row.rewards as { items?: [number, number][] } | null) ?? {};
  const delivery = (row.delivery as { enabled?: boolean; itemId?: number; count?: number } | null) ?? {};

  return {
    id: row.id,
    name: row.name,
    lookType: row.lookType,
    categoryId: row.categoryId ?? 0,
    type: TASK_TYPES.includes(row.type as (typeof TASK_TYPES)[number])
      ? (row.type as (typeof TASK_TYPES)[number])
      : "kill",
    difficulty: TASK_DIFFICULTIES.includes(row.difficulty as (typeof TASK_DIFFICULTIES)[number])
      ? (row.difficulty as (typeof TASK_DIFFICULTIES)[number])
      : "easy",
    levelRequired: row.levelRequired,
    rankRequired: row.rankRequired,
    killsRequired: row.killsRequired,
    points: row.points,
    experience: row.experience,
    money: row.money,
    published: row.published,
    monsters,
    rewardItems: (rewards.items ?? []).map(([itemId, count]) => ({ itemId, count })),
    deliveryEnabled: delivery.enabled ?? false,
    deliveryItemId: delivery.itemId ?? 0,
    deliveryCount: delivery.count ?? 0,
    postId: row.postId,
  };
}
