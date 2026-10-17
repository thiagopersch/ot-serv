/**
 * Estado (em memória, único processo Node) de imports em lote de monstros (XML) em andamento —
 * ver `import-runner.ts` para quem escreve neste store e os endpoints em
 * `app/api/admin/monsters/import/` para quem lê. Mesmo padrão de
 * `lib/tibia-client/import-job-store.ts`: não há fila externa (Redis/BullMQ), o deploy é um
 * único processo Node persistente em Docker — um `Map` no processo é suficiente, e o progresso
 * (não o resultado final, sempre gravado em auditoria) se perde se o processo reiniciar no meio.
 *
 * Guardado em `globalThis` (mesmo padrão de `lib/prisma.ts`): no `next dev` o Fast Refresh
 * recarrega módulos do servidor a cada arquivo salvo, o que reinicializaria um `Map`/variável de
 * módulo comuns no meio de um import já em andamento.
 */
export type MonsterImportJobStatus = "running" | "done" | "error";

export type MonsterImportJob = {
  jobId: string;
  status: MonsterImportJobStatus;
  startedAt: number;
  updatedAt: number;
  accountId: number;
  total: number;
  processed: number;
  imported: number;
  skipped: number;
  /** Mensagens de arquivos ignorados/falhos no parse do lote (limitado às 50 primeiras). */
  errors: string[];
  errorMessage: string | null;
};

type JobStoreState = {
  jobs: Map<string, MonsterImportJob>;
  activeJobId: string | null;
};

const globalForJobStore = globalThis as unknown as {
  monsterImportJobStore: JobStoreState | undefined;
};

const state: JobStoreState = (globalForJobStore.monsterImportJobStore ??= {
  jobs: new Map<string, MonsterImportJob>(),
  activeJobId: null,
});

export function hasActiveJob(): boolean {
  if (!state.activeJobId) return false;
  const job = state.jobs.get(state.activeJobId);
  return job?.status === "running";
}

export function getActiveJob(): MonsterImportJob | null {
  if (!state.activeJobId) return null;
  const job = state.jobs.get(state.activeJobId);
  // Retorna só job em andamento — um job finalizado não pode "reabrir" o estado de conclusão:
  // ao reabrir o dialog de import, o form precisa voltar a permitir novo import.
  return job?.status === "running" ? job : null;
}

export function getJob(jobId: string): MonsterImportJob | null {
  return state.jobs.get(jobId) ?? null;
}

export function createJob(jobId: string, accountId: number): MonsterImportJob {
  pruneOldJobs();
  const now = Date.now();
  const job: MonsterImportJob = {
    jobId,
    status: "running",
    startedAt: now,
    updatedAt: now,
    accountId,
    total: 0,
    processed: 0,
    imported: 0,
    skipped: 0,
    errors: [],
    errorMessage: null,
  };
  state.jobs.set(jobId, job);
  state.activeJobId = jobId;
  return job;
}

export function updateJob(jobId: string, patch: Partial<MonsterImportJob>): void {
  const job = state.jobs.get(jobId);
  if (!job) return;
  Object.assign(job, patch, { updatedAt: Date.now() });
}

/** Soma os contadores incrementais (`processed`/`imported`/`skipped`) ao valor atual do job. */
export function incrementJob(
  jobId: string,
  patch: { processed?: number; imported?: number; skipped?: number }
): void {
  const job = state.jobs.get(jobId);
  if (!job) return;
  if (patch.processed) job.processed += patch.processed;
  if (patch.imported) job.imported += patch.imported;
  if (patch.skipped) job.skipped += patch.skipped;
  job.updatedAt = Date.now();
}

/** Adiciona uma mensagem de arquivo ignorado/falho, mantendo no máximo 50 no progresso. */
export function pushJobError(jobId: string, error: string): void {
  const job = state.jobs.get(jobId);
  if (!job) return;
  if (job.errors.length < 50) job.errors.push(error);
  job.updatedAt = Date.now();
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