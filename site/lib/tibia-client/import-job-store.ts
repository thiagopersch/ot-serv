/**
 * Estado (em memória, único processo Node) de imports de cliente Tibia em andamento — ver
 * `import-runner.ts` para quem escreve neste store e os endpoints em
 * `app/api/admin/looktypes/import-client/` para quem lê. Não há fila externa (Redis/BullMQ):
 * o deploy é um único processo Node persistente em Docker (ver `AGENTS.md`), então um `Map` no
 * processo é suficiente — mas isso significa que o progresso (não o resultado final, sempre
 * gravado em auditoria) se perde se o processo reiniciar no meio de um import.
 *
 * Guardado em `globalThis` (mesmo padrão de `lib/prisma.ts`) em vez de uma variável de módulo
 * solta — essencial no `next dev`: o Fast Refresh recarrega módulos do servidor a cada arquivo
 * salvo, o que reinicializaria um `Map`/variável de módulo comuns no meio de um import já em
 * andamento. Isso já causou dois problemas reais durante o desenvolvimento desta feature: (1) o
 * polling de status passava a dar 404 pro job que continuava rodando "escondido" no módulo antigo,
 * e (2) o lock de "só 1 job ativo por vez" (também perdido no reload) deixava iniciar um SEGUNDO
 * import em paralelo ao primeiro, que seguia rodando sem que ninguém mais conseguisse vê-lo.
 */
export type ImportJobStatus = "running" | "done" | "error" | "cancelled";

export type ImportJobCategoryCounts = {
  total: number;
  created: number;
  /** Looktype já existente (mesmo nome, mesmo número, ou id embutido no nome) que estava
   * vinculado a algo (item/monstro/npc/vocação/spell) — atualizado no lugar (nome/sprite
   * corrigidos) em vez de apagado, pra não quebrar quem já referencia esse id. */
  updated: number;
  /** Hoje só usado para a corrida residual de criação concorrente (P2002) — a decisão de
   * apagar/atualizar duplicatas já resolve o caso comum de "já existe", ver `import-runner.ts`. */
  skipped: number;
  errored: number;
};

export type ImportJobCategory = "item" | "outfit" | "effect" | "missile";

export type ImportJobProgress = {
  jobId: string;
  status: ImportJobStatus;
  startedAt: number;
  updatedAt: number;
  accountId: number;
  currentCategory: ImportJobCategory | null;
  perCategory: Record<ImportJobCategory, ImportJobCategoryCounts>;
  warnings: string[];
  errorMessage: string | null;
  cancelRequested: boolean;
};

type JobStoreState = {
  jobs: Map<string, ImportJobProgress>;
  activeJobId: string | null;
};

const globalForJobStore = globalThis as unknown as {
  looktypeImportJobStore: JobStoreState | undefined;
};

const state: JobStoreState = (globalForJobStore.looktypeImportJobStore ??= {
  jobs: new Map<string, ImportJobProgress>(),
  activeJobId: null,
});

function emptyCounts(): ImportJobCategoryCounts {
  return { total: 0, created: 0, updated: 0, skipped: 0, errored: 0 };
}

export function hasActiveJob(): boolean {
  if (!state.activeJobId) return false;
  const job = state.jobs.get(state.activeJobId);
  return job?.status === "running";
}

export function getActiveJob(): ImportJobProgress | null {
  if (!state.activeJobId) return null;
  return state.jobs.get(state.activeJobId) ?? null;
}

export function getJob(jobId: string): ImportJobProgress | null {
  return state.jobs.get(jobId) ?? null;
}

export function createJob(jobId: string, accountId: number): ImportJobProgress {
  pruneOldJobs();
  const now = Date.now();
  const job: ImportJobProgress = {
    jobId,
    status: "running",
    startedAt: now,
    updatedAt: now,
    accountId,
    currentCategory: null,
    perCategory: {
      item: emptyCounts(),
      outfit: emptyCounts(),
      effect: emptyCounts(),
      missile: emptyCounts(),
    },
    warnings: [],
    errorMessage: null,
    cancelRequested: false,
  };
  state.jobs.set(jobId, job);
  state.activeJobId = jobId;
  return job;
}

export function updateJob(jobId: string, patch: Partial<ImportJobProgress>): void {
  const job = state.jobs.get(jobId);
  if (!job) return;
  Object.assign(job, patch, { updatedAt: Date.now() });
}

export function incrementCount(
  jobId: string,
  category: ImportJobCategory,
  field: keyof ImportJobCategoryCounts
): void {
  const job = state.jobs.get(jobId);
  if (!job) return;
  job.perCategory[category][field] += 1;
  job.updatedAt = Date.now();
}

export function requestCancel(jobId: string): boolean {
  const job = state.jobs.get(jobId);
  if (!job || job.status !== "running") return false;
  job.cancelRequested = true;
  job.updatedAt = Date.now();
  return true;
}

/** Remove jobs finalizados (não `running`) há mais de `maxAgeMs` — evita crescimento ilimitado do
 * `Map` num processo de vida longa com muitos imports ao longo do tempo. Chamado a cada
 * `createJob`, não precisa de um timer dedicado. */
function pruneOldJobs(maxAgeMs = 30 * 60 * 1000): void {
  const now = Date.now();
  for (const [id, job] of state.jobs) {
    if (job.status !== "running" && now - job.updatedAt > maxAgeMs) state.jobs.delete(id);
  }
}
