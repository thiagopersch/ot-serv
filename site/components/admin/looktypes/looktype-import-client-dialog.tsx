"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

import { fetcher, FetchError } from "@/lib/fetcher";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ImportJobCategory = "item" | "outfit" | "effect" | "missile";
type ImportJobCategoryCounts = { total: number; created: number; updated: number; skipped: number; errored: number };
type ImportJobStatus = "running" | "done" | "error" | "cancelled";

type ImportJobProgress = {
  jobId: string;
  status: ImportJobStatus;
  currentCategory: ImportJobCategory | null;
  perCategory: Record<ImportJobCategory, ImportJobCategoryCounts>;
  warnings: string[];
  errorMessage: string | null;
};

const ALL_CATEGORIES: ImportJobCategory[] = ["item", "outfit", "effect", "missile"];

const CATEGORY_LABELS: Record<ImportJobCategory, string> = {
  item: "Items",
  outfit: "Outfits",
  effect: "Efeitos",
  missile: "Distance effects",
};

type RequiredFile = { label: string; file: File | null };

function findFileByName(files: FileList, suffix: string): File | null {
  const lower = suffix.toLowerCase();
  for (const file of Array.from(files)) {
    const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    if (relativePath.toLowerCase().endsWith(lower)) return file;
  }
  return null;
}

type LooktypeImportClientDialogProps = {
  trigger: React.ReactNode;
  onImported: () => void;
};

export function LooktypeImportClientDialog({ trigger, onImported }: LooktypeImportClientDialogProps) {
  const [open, setOpen] = useState(false);
  const [datFile, setDatFile] = useState<File | null>(null);
  const [sprFile, setSprFile] = useState<File | null>(null);
  const [otfiFile, setOtfiFile] = useState<File | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<ImportJobCategory[]>(ALL_CATEGORIES);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  // Setado assim que um import é iniciado com sucesso; só volta a `false` quando o job chega num
  // status terminal OU o admin reconhece explicitamente que perdeu o rastreamento (botão "Fechar
  // mesmo assim" no estado de conexão perdida, abaixo). As proteções de fechar (confirmação e
  // `beforeunload`) usam ESTA flag, não o status ao vivo do job — assim continuam ativas mesmo se
  // o polling de status estiver falhando (ex.: servidor reiniciou, 404), em vez de simplesmente
  // parar de funcionar em silêncio.
  const [isPendingImport, setIsPendingImport] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const filePickerOpenRef = useRef(false);
  const notifiedDoneRef = useRef(false);

  // Retoma um import em andamento (iniciado por qualquer sessão) ao abrir o dialog — valor
  // derivado (não `setState` num efeito) para não disparar renders em cascata: enquanto o admin
  // não iniciou um import nesta aba (`jobId` ainda nulo), usa o job ativo do servidor, se houver.
  // `onSuccess` (callback do SWR, não um `useEffect`) arma a proteção de fechar assim que um job
  // em andamento de outra sessão é encontrado.
  const { data: activeJobData } = useSWR<{ job: ImportJobProgress | null }>(
    open && !jobId ? "/api/admin/looktypes/import-client" : null,
    fetcher,
    {
      onSuccess: (data) => {
        if (data.job) setIsPendingImport(true);
      },
    }
  );
  const effectiveJobId = jobId ?? activeJobData?.job?.jobId ?? null;

  const { data: jobData, error: jobError, mutate: refetchJob } = useSWR<{ job: ImportJobProgress }>(
    effectiveJobId ? `/api/admin/looktypes/import-client/${effectiveJobId}` : null,
    fetcher,
    {
      refreshInterval: (data) => (data?.job.status === "running" ? 1000 : 0),
      // O SWR tenta de novo automaticamente em erro por padrão (backoff) — aqui isso só faria o
      // dialog martelar um `jobId` que já sumiu (404) pra sempre em silêncio. Erro vira um estado
      // explícito ("conexão perdida", abaixo) com um botão manual de "tentar novamente".
      shouldRetryOnError: false,
      onSuccess: (data) => setIsPendingImport(data.job.status === "running"),
    }
  );
  const job = jobData?.job ?? null;
  const isRunning = job?.status === "running";
  const connectionLost = Boolean(jobError) && !job;
  const connectionLostIsGone = jobError instanceof FetchError && jobError.status === 404;

  useEffect(() => {
    if (!job || job.status === "running" || notifiedDoneRef.current) return;
    notifiedDoneRef.current = true;

    const totals = (Object.values(job.perCategory) as ImportJobCategoryCounts[]).reduce(
      (acc, count) => ({
        created: acc.created + count.created,
        updated: acc.updated + count.updated,
        skipped: acc.skipped + count.skipped,
        errored: acc.errored + count.errored,
      }),
      { created: 0, updated: 0, skipped: 0, errored: 0 }
    );

    if (job.status === "error") {
      toast.error(`Falha ao importar o cliente: ${job.errorMessage ?? "erro desconhecido"}.`);
    } else {
      const suffix = job.status === "cancelled" ? " (cancelado)" : "";
      toast.success(
        `Import concluído${suffix}: ${totals.created} criada(s), ${totals.updated} atualizada(s), ${totals.skipped} pulada(s), ${totals.errored} com erro.`
      );
      if (totals.errored > 0) {
        toast.message("Veja os detalhes por item em Auditoria.");
      }
      onImported();
    }
  }, [job, onImported]);

  // Fechar a aba/atualizar a página durante um import em andamento não cancela nada por padrão —
  // aqui a decisão do usuário é o oposto: sair deve exigir confirmação e, se confirmado, cancelar
  // de verdade (não deixar o job "escondido" rodando sem ninguém acompanhar). O aviso nativo do
  // browser não pode ser customizado (limitação de segurança), mas o efeito (confirmação
  // obrigatória) é o mesmo. `sendBeacon` garante que o cancelamento seja disparado mesmo que a
  // página descarregue antes de um `fetch` normal terminar.
  useEffect(() => {
    if (!isPendingImport) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    function handlePageHide() {
      if (effectiveJobId) navigator.sendBeacon(`/api/admin/looktypes/import-client/${effectiveJobId}/cancel`, new Blob());
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [isPendingImport, effectiveJobId]);

  function reset() {
    setDatFile(null);
    setSprFile(null);
    setOtfiFile(null);
    setSelectedCategories(ALL_CATEGORIES);
    setOverwriteExisting(false);
    setJobId(null);
    setIsPendingImport(false);
    notifiedDoneRef.current = false;
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleFolderSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setDatFile(findFileByName(files, "tibia.dat"));
    setSprFile(findFileByName(files, "tibia.spr"));
    setOtfiFile(findFileByName(files, "tibia.otfi"));
  }

  function toggleCategory(category: ImportJobCategory) {
    setSelectedCategories((current) =>
      current.includes(category) ? current.filter((c) => c !== category) : [...current, category]
    );
  }

  async function handleImport() {
    if (!datFile || !sprFile) {
      toast.error("Selecione uma pasta contendo Tibia.dat e Tibia.spr.");
      return;
    }
    if (selectedCategories.length === 0) {
      toast.error("Selecione ao menos um tipo para importar.");
      return;
    }

    setIsStarting(true);
    try {
      const formData = new FormData();
      formData.append("datFile", datFile);
      formData.append("sprFile", sprFile);
      if (otfiFile) formData.append("otfiFile", otfiFile);
      formData.append("categories", JSON.stringify(selectedCategories));
      formData.append("overwriteExisting", String(overwriteExisting));

      const response = await fetch("/api/admin/looktypes/import-client", { method: "POST", body: formData });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        toast.error(data?.error ?? "Não foi possível iniciar o import.");
        return;
      }

      notifiedDoneRef.current = false;
      setIsPendingImport(true);
      setJobId(data.jobId);
    } catch {
      toast.error("Falha de rede ao iniciar o import.");
    } finally {
      setIsStarting(false);
    }
  }

  async function handleCancel() {
    if (!effectiveJobId) return;
    const response = await fetch(`/api/admin/looktypes/import-client/${effectiveJobId}/cancel`, { method: "POST" });
    if (!response.ok) {
      toast.error("Não foi possível cancelar (o import pode já ter terminado).");
      return;
    }
    toast.message("Cancelamento solicitado — aguardando o job parar com segurança.");
  }

  async function confirmCloseWhileRunning() {
    setShowCloseConfirm(false);
    if (!connectionLost) await handleCancel();
    setOpen(false);
    reset();
  }

  const requiredFiles: RequiredFile[] = [
    { label: "Tibia.dat", file: datFile },
    { label: "Tibia.spr", file: sprFile },
  ];
  const canImport = datFile !== null && sprFile !== null && selectedCategories.length > 0 && !isStarting && !effectiveJobId;
  // Enquanto houver um `effectiveJobId` (import iniciado nesta aba, ou retomado de outra), o
  // formulário de seleção de pasta fica escondido — mostra progresso, o estado de "conexão
  // perdida" (`connectionLost`), ou um carregando transitório enquanto o primeiro fetch de status
  // não voltou ainda.
  const showForm = !effectiveJobId;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && filePickerOpenRef.current) return;
          if (!next && isPendingImport) {
            setShowCloseConfirm(true);
            return;
          }
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogTrigger render={trigger as React.ReactElement} />
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar do cliente Tibia</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {showForm && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label>Pasta do cliente (Tibia.dat, Tibia.spr e Tibia.otfi)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      filePickerOpenRef.current = true;
                      inputRef.current?.click();
                    }}
                  >
                    Selecionar pasta...
                  </Button>
                  <input
                    ref={inputRef}
                    type="file"
                    // @ts-expect-error -- atributos não-padrão do Chromium/Edge para seleção de pasta
                    webkitdirectory="true"
                    directory=""
                    multiple
                    className="absolute h-px w-px opacity-0"
                    onChange={(event) => {
                      handleFolderSelected(event);
                      event.target.value = "";
                      setTimeout(() => {
                        filePickerOpenRef.current = false;
                      }, 0);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Só funciona em navegadores baseados em Chromium (Chrome/Edge).
                  </p>
                </div>

                <div className="flex flex-col gap-1.5 rounded-md border border-border p-3 text-sm">
                  {requiredFiles.map((entry) => (
                    <div key={entry.label} className="flex items-center gap-2">
                      {entry.file ? (
                        <CheckCircle2 className="size-4 text-green-600" />
                      ) : (
                        <Circle className="size-4 text-muted-foreground" />
                      )}
                      <span>{entry.label}</span>
                      {entry.file && <span className="text-xs text-muted-foreground">({entry.file.name})</span>}
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    {otfiFile ? (
                      <CheckCircle2 className="size-4 text-green-600" />
                    ) : (
                      <Circle className="size-4 text-muted-foreground" />
                    )}
                    <span>Tibia.otfi (opcional)</span>
                    {otfiFile && <span className="text-xs text-muted-foreground">({otfiFile.name})</span>}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>O que importar</Label>
                  <div className="flex flex-col gap-1.5 rounded-md border border-border p-3 text-sm">
                    {ALL_CATEGORIES.map((category) => (
                      <label key={category} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(category)}
                          onChange={() => toggleCategory(category)}
                          className="size-4"
                        />
                        {CATEGORY_LABELS[category]}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Importar só algumas categorias acelera o processo — útil pra testar ou reimportar depois de uma
                    correção. Um looktype já existente com o mesmo id/nome nunca é duplicado pelo import.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5 rounded-md border border-border p-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={overwriteExisting}
                      onChange={(event) => setOverwriteExisting(event.target.checked)}
                      className="size-4"
                    />
                    Sobrescrever cadastro existente
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Desmarcado: looktypes já existentes são preservados (o import pula quem já está no
                    cadastro). Marcado: o registro existente é atualizado no lugar — mesmo id, com o nome e a
                    sprite do cliente — evitando cadastros duplicados.
                  </p>
                </div>
              </>
            )}

            {job && (
              <div className="flex flex-col gap-3">
                {job.warnings.length > 0 && (
                  <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-2 text-xs text-yellow-700 dark:text-yellow-400">
                    {job.warnings.map((warning, index) => (
                      <p key={index}>{warning}</p>
                    ))}
                  </div>
                )}

                {(Object.keys(job.perCategory) as ImportJobCategory[]).map((category) => {
                  const counts = job.perCategory[category];
                  if (counts.total === 0) return null;
                  const done = counts.created + counts.updated + counts.skipped + counts.errored;
                  const percent = counts.total > 0 ? Math.min(100, Math.round((done / counts.total) * 100)) : 0;
                  return (
                    <div key={category} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">
                          {CATEGORY_LABELS[category]}
                          {job.currentCategory === category && (
                            <Loader2 className="ml-1 inline size-3 animate-spin" />
                          )}
                        </span>
                        <span className="text-muted-foreground">
                          {done}/{counts.total} — {counts.created} criada(s), {counts.updated} atualizada(s),{" "}
                          {counts.skipped} pulada(s), {counts.errored} erro(s)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}

                {job.status === "error" && <p className="text-sm text-destructive">Erro: {job.errorMessage}</p>}
                {job.status !== "running" && job.status !== "error" && (
                  <p className="text-sm text-muted-foreground">
                    Import {job.status === "cancelled" ? "cancelado" : "concluído"}.
                  </p>
                )}
              </div>
            )}

            {connectionLost && (
              <div className="flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                <p className="font-medium text-destructive">Perdemos a conexão com o acompanhamento deste import.</p>
                <p className="text-muted-foreground">
                  {connectionLostIsGone
                    ? "O servidor não reconhece mais este import (ex.: reiniciou no meio do processo)."
                    : "Não foi possível confirmar o status deste import."}{" "}
                  Ele pode ter sido interrompido ou pode ainda estar rodando em segundo plano. Confira o resultado em
                  Auditoria (ações <code>import_summary</code>/<code>import_client_error</code>) se o problema
                  persistir.
                </p>
                <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => refetchJob()}>
                  Tentar novamente
                </Button>
              </div>
            )}

            {!job && !connectionLost && effectiveJobId && (
              <p className="text-sm text-muted-foreground">Conectando ao import em andamento...</p>
            )}
          </div>

          <DialogFooter>
            {connectionLost ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCloseConfirm(true);
                }}
              >
                Fechar mesmo assim
              </Button>
            ) : isRunning ? (
              <Button type="button" variant="destructive" onClick={handleCancel}>
                Cancelar importação
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
              >
                Fechar
              </Button>
            )}
            {showForm && (
              <Button type="button" disabled={!canImport} onClick={handleImport}>
                {isStarting ? "Iniciando..." : "Importar"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {connectionLost ? "Fechar sem confirmar o resultado do import?" : "Cancelar a importação em andamento?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {connectionLost
                ? "Perdemos a conexão com este import — não sabemos se ele terminou, foi interrompido ou ainda está rodando. Fechar agora não afeta o que já rodou no servidor; confira o resultado em Auditoria depois."
                : "Há uma importação em andamento. Se você fechar agora, ela será cancelada e só o que já foi processado até este momento ficará salvo — o restante será perdido."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{connectionLost ? "Continuar tentando" : "Continuar importando"}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmCloseWhileRunning}>
              {connectionLost ? "Fechar" : "Cancelar e fechar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
