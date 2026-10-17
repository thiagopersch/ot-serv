/** Tipos fixos de task (enum) — o servidor só permite 1 task ativa por tipo ao mesmo tempo por
 * jogador (task_core.lua: TaskCore_startTask). */
export const TASK_TYPES = ["kill", "delivery"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  kill: "Kill",
  delivery: "Entrega",
};

export function isTaskType(value: string): value is TaskType {
  return (TASK_TYPES as readonly string[]).includes(value);
}
