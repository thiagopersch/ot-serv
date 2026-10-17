/** Dificuldades fixas de task (enum) — label em português + cor usada tanto no select do
 * formulário quanto na badge da listagem (`/admin/tasks`). */
export const TASK_DIFFICULTIES = ["easy", "medium", "hard", "extreme"] as const;
export type TaskDifficulty = (typeof TASK_DIFFICULTIES)[number];

export const TASK_DIFFICULTY_LABELS: Record<TaskDifficulty, string> = {
  easy: "Fácil",
  medium: "Médio",
  hard: "Difícil",
  extreme: "Elite",
};

export const TASK_DIFFICULTY_COLORS: Record<TaskDifficulty, string> = {
  easy: "#22c55e",
  medium: "#3b82f6",
  hard: "#ef4444",
  extreme: "#a855f7",
};

export function isTaskDifficulty(value: string): value is TaskDifficulty {
  return (TASK_DIFFICULTIES as readonly string[]).includes(value);
}
