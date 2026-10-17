"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { CheckCircle2, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EntitySearchCombobox } from "@/components/shared/entity-search-combobox";
import { UniverseBadge } from "@/components/shared/universe-badge";
import { fetcher, FetchError } from "@/lib/fetcher";

type UniverseRow = { id: number; name: string; color: string | null };

type MonsterImportJobStatus = "running" | "done" | "error";

type MonsterImportJob = {
  jobId: string;
  status: MonsterImportJobStatus;
  total: number;
  processed: number;
  imported: number;
  skipped: number;
  errors: string[];
  errorMessage: string | null;
};

/** Import de um ou mais arquivos XML de monstro de uma vez — diferente de Item/Movement
 * (um XML bundlando várias linhas), cada monstro é seu próprio arquivo
 * (`data/monster/*.xml`, um único `<monster>` por arquivo). O processamento roda em segundo plano
 * num job no servidor; a barra de progresso acompanha via polling de `GET /import/[jobId]`. */
export function MonsterXmlImportDialog({
  onImported,
}: {
  onImported: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [universeId, setUniverseId] = useState<number | null>(null);
  const [subcategory, setSubcategory] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const notifiedDoneRef = useRef(false);

  // Retoma um import em andamento (iniciado por qualquer sessão) ao abrir o dialog — enquanto o
  // admin não iniciou um import nesta aba (`jobId` ainda nulo), usa o job ativo do servidor.
  const { data: activeJobData } = useSWR<{ job: MonsterImportJob | null }>(
    open && !jobId ? "/api/admin/monsters/import" : null,
    fetcher,
  );
  const effectiveJobId = jobId ?? activeJobData?.job?.jobId ?? null;

  const { data: jobData, error: jobError, mutate: refetchJob } = useSWR<{ job: MonsterImportJob }>(
    effectiveJobId ? `/api/admin/monsters/import/${effectiveJobId}` : null,
    fetcher,
    {
      refreshInterval: (data) => (data?.job.status === "running" ? 500 : 0),
      shouldRetryOnError: false,
    },
  );
  const job = jobData?.job ?? null;
  const isRunning = job?.status === "running";
  const connectionLost = Boolean(jobError) && !job;
  const connectionLostIsGone = jobError instanceof FetchError && jobError.status === 404;

  useEffect(() => {
    if (!job || job.status === "running" || notifiedDoneRef.current) return;
    notifiedDoneRef.current = true;

    if (job.status === "error") {
      toast.error(`Falha ao importar os monstros: ${job.errorMessage ?? "erro desconhecido"}.`);
      return;
    }

    toast.success(
      `${job.imported} monstro(s) importado(s)${job.skipped ? `, ${job.skipped} ignorado(s)` : ""}.`,
    );
    if (job.errors.length > 0) {
      console.warn("Monstros ignorados na importação:", job.errors);
    }
    onImported();
  }, [job, onImported]);

  async function handleImport() {
    const files = fileInputRef.current?.files;

    if (!universeId) {
      toast.error("Selecione o universo.");
      return;
    }

    if (!subcategory.trim()) {
      toast.error("Informe a subcategoria/subpasta.");
      return;
    }

    if (!files || files.length === 0) {
      toast.error("Selecione ao menos um arquivo XML.");
      return;
    }

    setIsStarting(true);

    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));
    formData.append("replaceExisting", String(replaceExisting));
    formData.append("universeId", String(universeId));
    formData.append("subcategory", subcategory.trim());

    const response = await fetch("/api/admin/monsters/import", {
      method: "POST",
      body: formData,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      setIsStarting(false);
      toast.error(data?.error ?? "Não foi possível importar os arquivos.");
      return;
    }

    notifiedDoneRef.current = false;
    setJobId(data.jobId);
    setIsStarting(false);
  }

  function reset() {
    setReplaceExisting(false);
    setUniverseId(null);
    setSubcategory("");
    setJobId(null);
    notifiedDoneRef.current = false;
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const showForm = !effectiveJobId;

  const percent =
    job && job.total > 0 ? Math.min(100, Math.round((job.processed / job.total) * 100)) : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline">
            <Upload className="size-4" />
            Importar monstro (XML)
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar monstros</DialogTitle>
          <DialogDescription>
            {showForm ? (
              <>
                Envie um ou mais arquivos no formato <code>data/monster/*.xml</code>{" "}
                do OTServer (um único <code>{"<monster>"}</code> por arquivo) — todos são
                importados de uma vez, com o universo e a subcategoria/subpasta informados
                abaixo aplicados a todos os monstros do lote. A looktype de outfit é vinculada
                automaticamente pelo <code>{"<look type>"}</code> do XML.
              </>
            ) : (
              "Acompanhe o progresso da importação dos arquivos abaixo."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {showForm && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>Universo</Label>
                <EntitySearchCombobox<UniverseRow>
                  endpoint="/api/admin/universes"
                  value={universeId}
                  placeholder="Buscar universo..."
                  formatOption={(row) => row.name}
                  renderOption={(row) => <UniverseBadge name={row.name} color={row.color} />}
                  onSelect={(row) => setUniverseId(row?.id ?? null)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="monster-import-subcategory">
                  Subcategoria / subpasta
                </Label>
                <Input
                  id="monster-import-subcategory"
                  value={subcategory}
                  onChange={(event) => setSubcategory(event.target.value)}
                  placeholder='ex.: "1-50" ou "bosses"'
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="monster-import-files">Arquivo(s) XML</Label>
                <Input
                  id="monster-import-files"
                  type="file"
                  accept=".xml"
                  multiple
                  ref={fileInputRef}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="monster-import-replace"
                  type="checkbox"
                  className="size-4"
                  checked={replaceExisting}
                  onChange={(event) => setReplaceExisting(event.target.checked)}
                />
                <Label htmlFor="monster-import-replace" className="font-normal">
                  Atualizar cadastro se já existir um monstro com esse nome
                </Label>
              </div>
            </>
          )}

          {job && (
            <div className="flex flex-col gap-2 rounded-md border border-border p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">
                  {isRunning ? "Importando monstros" : "Importação de monstros"}
                  {isRunning && <Loader2 className="ml-1 inline size-3 animate-spin" />}
                </span>
                <span className="text-muted-foreground">
                  {job.processed}/{job.total} arquivo(s)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {job.imported} importado(s), {job.skipped} ignorado(s)
                {isRunning && job.processed < job.total
                  ? ` — processando arquivo ${job.processed + 1} de ${job.total}...`
                  : ""}
              </p>
              {job.status === "error" && (
                <p className="text-sm text-destructive">Erro: {job.errorMessage}</p>
              )}
              {job.status === "done" && (
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <CheckCircle2 className="size-4 text-green-600" />
                  Importação concluída.
                </p>
              )}
              {job.errors.length > 0 && (
                <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-2 text-xs text-yellow-700 dark:text-yellow-400">
                  {job.errors.length} arquivo(s) ignorado(s):{" "}
                  {job.errors.slice(0, 3).join(" | ")}
                  {job.errors.length > 3 ? ` (+${job.errors.length - 3} outros)` : ""}
                </div>
              )}
            </div>
          )}

          {connectionLost && (
            <div className="flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <p className="font-medium text-destructive">
                Perdemos o acompanhamento desta importação.
              </p>
              <p className="text-muted-foreground">
                {connectionLostIsGone
                  ? "O servidor não reconhece mais este import (ex.: reiniciou no meio do processo)."
                  : "Não foi possível confirmar o status desta importação."}{" "}
                Ela pode ter sido interrompida ou ainda estar rodando em segundo plano. Confira o
                resultado em Auditoria.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => refetchJob()}
              >
                Tentar novamente
              </Button>
            </div>
          )}

          {!job && !connectionLost && effectiveJobId && (
            <p className="text-sm text-muted-foreground">
              Iniciando a importação...
            </p>
          )}
        </div>

        <DialogFooter>
          {showForm ? (
            <Button onClick={handleImport} disabled={isStarting}>
              {isStarting ? "Iniciando..." : "Importar"}
            </Button>
          ) : isRunning ? (
            <Button type="button" variant="outline" disabled>
              Importando...
            </Button>
          ) : (
            <>
              {job && !connectionLost && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => reset()}
                >
                  Importar mais
                </Button>
              )}
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
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}