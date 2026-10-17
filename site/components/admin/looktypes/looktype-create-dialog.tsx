"use client";

import { useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import type { Looktype } from "@/lib/generated/prisma/client";
import {
  DEFAULT_LOOKTYPE_FRAME_SPEED_MS,
  extractLooktypeNumberFromFileName,
  fileNameToLooktypeName,
  type LooktypeCategory,
} from "@/lib/validations/admin/looktype";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LooktypeCategoryFields } from "@/components/admin/looktypes/looktype-category-fields";

const MAX_FILES = 10000;
/** Requisições simultâneas ao criar em lote — cada upload envolve parse/render de OBD no
 * servidor (CPU-bound), então um valor alto satura o processo Node em vez de acelerar. */
const UPLOAD_CONCURRENCY = 8;
/** Altura (px) de cada linha da lista de revisão, incluindo o espaçamento entre linhas — usada
 * pelo virtualizador (`@tanstack/react-virtual`) para calcular quais linhas renderizar sem
 * precisar montar as ~10000 linhas possíveis de uma vez (o que travaria o navegador). */
const REVIEW_ROW_HEIGHT = 44;

type PendingFile = {
  file: File;
  name: string;
  looktypeNumber: number | null;
};

type LooktypeCreateDialogProps = {
  trigger: React.ReactNode;
  onCreated: (looktype: Looktype) => void;
};

export function LooktypeCreateDialog({ trigger, onCreated }: LooktypeCreateDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [category, setCategory] = useState<LooktypeCategory>("item");
  const [sharedLooktypeNumber, setSharedLooktypeNumber] = useState<number | null>(null);
  const [frameSpeedMs, setFrameSpeedMs] = useState(DEFAULT_LOOKTYPE_FRAME_SPEED_MS.item);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const reviewScrollRef = useRef<HTMLDivElement>(null);
  // O seletor nativo de arquivos do SO tira o foco da janela; sem essa trava o base-ui pode
  // interpretar isso como um clique/foco fora do dialog e fechá-lo antes do usuário escolher
  // os arquivos. Fica true enquanto o seletor está (provavelmente) aberto.
  const filePickerOpenRef = useRef(false);

  // Renderiza só as linhas visíveis da lista de revisão — com lotes de até `MAX_FILES` (10000)
  // arquivos, montar uma `<div>` com 2 `<Input>` por linha para todas de uma vez travaria o
  // navegador.
  const reviewVirtualizer = useVirtualizer({
    count: pendingFiles.length,
    getScrollElement: () => reviewScrollRef.current,
    estimateSize: () => REVIEW_ROW_HEIGHT,
    overscan: 8,
  });

  useEffect(() => {
    function handleWindowFocus() {
      // Adia um tick pro base-ui processar o foco relacionado ao seletor nativo antes de destravar.
      setTimeout(() => {
        filePickerOpenRef.current = false;
      }, 0);
    }
    window.addEventListener("focus", handleWindowFocus);
    return () => window.removeEventListener("focus", handleWindowFocus);
  }, []);

  function reset() {
    setCategory("item");
    setSharedLooktypeNumber(null);
    setFrameSpeedMs(DEFAULT_LOOKTYPE_FRAME_SPEED_MS.item);
    setPendingFiles([]);
    setOverwriteExisting(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleCategoryChange(next: LooktypeCategory) {
    setCategory(next);
    setFrameSpeedMs(DEFAULT_LOOKTYPE_FRAME_SPEED_MS[next]);
  }

  function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    if (files.length > MAX_FILES) {
      toast.error(`Selecione no máximo ${MAX_FILES} arquivos por vez.`);
      return;
    }

    setPendingFiles(
      files.map((file) => ({
        file,
        name: fileNameToLooktypeName(file.name),
        // Padrão `nome_NUMERO_860v2[...].ext` dos lotes exportados do Object Builder — quando o
        // arquivo não segue esse padrão, cai pro número compartilhado (se o admin já tiver
        // digitado um) ou fica em branco, exigindo preenchimento manual antes de enviar.
        looktypeNumber: extractLooktypeNumberFromFileName(file.name) ?? sharedLooktypeNumber,
      })),
    );
  }

  function updatePendingFile(index: number, patch: Partial<PendingFile>) {
    setPendingFiles((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removePendingFile(index: number) {
    setPendingFiles((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (pendingFiles.length === 0) {
      toast.error("Selecione ao menos um arquivo (.obd, PNG ou GIF).");
      return;
    }
    if (pendingFiles.some((row) => !row.name.trim())) {
      toast.error("Informe um nome para todos os arquivos.");
      return;
    }
    if (category !== "item" && pendingFiles.some((row) => row.looktypeNumber === null)) {
      toast.error("Informe o número da sprite no Object Builder para todos os arquivos.");
      return;
    }

    // Detecta nome/número repetido dentro do próprio lote antes de subir qualquer coisa — evita
    // condição de corrida entre uploads concorrentes disputando o mesmo nome/número (o servidor
    // ainda faz a checagem definitiva contra o que já existe no banco, ver
    // `POST /api/admin/looktypes`). Mantém a primeira ocorrência de cada nome/número, marca as
    // seguintes como duplicata.
    const seenNames = new Map<string, PendingFile>();
    const seenNumbers = new Map<string, PendingFile>();
    const toUpload: PendingFile[] = [];
    const clientDuplicates: {
      fileName: string;
      name: string;
      looktypeNumber: number | null;
      category: string;
      reason: string;
    }[] = [];

    for (const row of pendingFiles) {
      const nameKey = row.name.trim().toLowerCase();
      const numberKey = row.looktypeNumber !== null ? String(row.looktypeNumber) : null;
      const duplicateOfName = seenNames.get(nameKey);
      const duplicateOfNumber = numberKey ? seenNumbers.get(numberKey) : undefined;

      if (duplicateOfName || duplicateOfNumber) {
        const conflictFile = (duplicateOfName ?? duplicateOfNumber)!.file.name;
        clientDuplicates.push({
          fileName: row.file.name,
          name: row.name,
          looktypeNumber: row.looktypeNumber,
          category,
          reason: duplicateOfName
            ? `Nome duplicado no mesmo lote (mesmo nome que "${conflictFile}").`
            : `Número duplicado no mesmo lote (mesmo número que "${conflictFile}").`,
        });
        continue;
      }

      seenNames.set(nameKey, row);
      if (numberKey) seenNumbers.set(numberKey, row);
      toUpload.push(row);
    }

    setIsSubmitting(true);
    setProgress({ done: 0, total: toUpload.length });

    const batchId =
      typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;

    if (clientDuplicates.length > 0) {
      await fetch("/api/admin/looktypes/import-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId, entries: clientDuplicates }),
      }).catch(() => null);
    }

    let createdCount = 0;
    // Cadastros que JÁ existiam no banco e foram atualizados no lugar (mesmo id, ver a flag de
    // sobrescrita e `POST /api/admin/looktypes`) — contagem à parte pra aparecer nos toasts sem
    // confundir com criação.
    let updatedCount = 0;
    let duplicateCount = clientDuplicates.length;
    // Nomes dos arquivos ignorados por já existir uma sprite com o mesmo nome (ou número, nas
    // categorias que usam número) — mostrados na mensagem final pro admin saber exatamente quais
    // arquivos precisa revisar, sem precisar abrir a Auditoria.
    const duplicateFileNames: string[] = clientDuplicates.map((entry) => entry.fileName);
    // Falhas "de verdade" (arquivo corrompido, tipo inválido etc.) — diferente de duplicateCount,
    // que já tem sua própria mensagem. Cada uma já fica registrada na Auditoria (action
    // "import_error", com o nome do arquivo e o motivo) pelo próprio endpoint, então aqui só
    // precisamos contar quantas deram errado pra avisar o admin — sem parar o restante do lote.
    let errorCount = 0;
    const errorFileNames: string[] = [];

    async function uploadRow(row: PendingFile) {
      const formData = new FormData();
      formData.append("file", row.file);
      formData.append("fileName", row.file.name);
      formData.append("name", row.name.trim());
      formData.append("category", category);
      formData.append("frameSpeedMs", String(frameSpeedMs));
      formData.append("batchId", batchId);
      formData.append("overwriteExisting", String(overwriteExisting));
      if (row.looktypeNumber !== null) formData.append("looktypeNumber", String(row.looktypeNumber));

      try {
        const response = await fetch("/api/admin/looktypes", { method: "POST", body: formData });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          if (data?.skipped) {
            duplicateCount += 1;
            duplicateFileNames.push(row.file.name);
          } else {
            errorCount += 1;
            errorFileNames.push(row.file.name);
          }
        } else {
          const data = await response.json();
          onCreated(data.looktype);
          // `overwritten: true` = o endpoint atualizou um cadastro existente no lugar (flag
          // marcada); senão, criou um novo.
          if (data?.overwritten) updatedCount += 1;
          else createdCount += 1;
        }
      } catch {
        // Falha de rede (não uma resposta de erro do servidor, que já é tratada acima) — não deve
        // travar o worker nem o restante do lote, só contar como falha.
        errorCount += 1;
        errorFileNames.push(row.file.name);
      }

      setProgress((current) => (current ? { ...current, done: current.done + 1 } : current));
    }

    // Sobe em lotes com concorrência limitada: paraleliza a rede sem estourar o processo do
    // servidor, que faz parse/render de OBD (CPU-bound) por requisição. `uploadRow` nunca lança
    // (erros viram contagem), então uma falha isolada nunca interrompe os arquivos restantes.
    let cursor = 0;
    async function worker() {
      while (cursor < toUpload.length) {
        const row = toUpload[cursor];
        cursor += 1;
        await uploadRow(row);
      }
    }
    await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, toUpload.length) }, worker));

    setIsSubmitting(false);
    setProgress(null);

    // Registra em auditoria o mesmo resumo mostrado nos toasts abaixo — uma linha única e fácil
    // de achar (ação "import_summary"), em vez de depender só da mensagem efêmera na tela ou de
    // juntar manualmente as dezenas de entradas por arquivo (`import_skip`/`import_error`).
    if (duplicateCount > 0 || errorCount > 0) {
      await fetch("/api/admin/looktypes/import-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId,
          category,
          createdCount,
          updatedCount,
          duplicateCount,
          errorCount,
          duplicateFileNames,
          errorFileNames,
        }),
      }).catch(() => null);
    }

    if (createdCount > 0 || updatedCount > 0) {
      const summary = [
        createdCount > 0 ? `${createdCount} looktype(s) criada(s)` : null,
        updatedCount > 0 ? `${updatedCount} sprite(s) existente(s) atualizada(s) no lugar` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      toast.success(`${summary} com sucesso.`);
    }
    if (duplicateCount > 0) {
      const MAX_NAMES_IN_TOAST = 5;
      const preview = duplicateFileNames.slice(0, MAX_NAMES_IN_TOAST).join(", ");
      const remaining = duplicateFileNames.length - MAX_NAMES_IN_TOAST;
      const suffix = remaining > 0 ? ` e mais ${remaining} arquivo(s) (veja todos em Auditoria)` : "";
      toast.error(
        `${duplicateCount} arquivo(s) não importado(s) por já existir uma sprite com o mesmo nome/número: ${preview}${suffix}.`,
      );
    }
    if (errorCount > 0) {
      toast.error(
        `${errorCount} arquivo(s) falharam ao importar — veja o arquivo e o motivo de cada um em Auditoria.`,
      );
    }

    if (duplicateCount === 0 && errorCount === 0) {
      reset();
      setOpen(false);
    }
  }

  const showReview = pendingFiles.length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Bloqueia fechamento enquanto o seletor nativo de arquivos está aberto (ver
        // `filePickerOpenRef`) ou enquanto o lote está sendo enviado — nesses casos um
        // clique fora/perda de foco é provavelmente espúrio, não uma intenção de fechar.
        if (!next && (filePickerOpenRef.current || isSubmitting)) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className={showReview ? "sm:max-w-2xl" : undefined}>
        <DialogHeader>
          <DialogTitle>Nova sprite / looktype</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Arquivos (.obd, PNG ou GIF — até {MAX_FILES} por vez)</Label>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                filePickerOpenRef.current = true;
                inputRef.current?.click();
              }}
            >
              {pendingFiles.length > 0
                ? `${pendingFiles.length} arquivo(s) selecionado(s)`
                : "Selecionar arquivos..."}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".obd,image/png,image/gif"
              multiple
              className="absolute h-px w-px opacity-0"
              onChange={handleFilesSelected}
            />
            <p className="text-xs text-muted-foreground">
              `.obd` do Object Builder vira animação; PNG/GIF ficam estáticos.
            </p>
          </div>

          <LooktypeCategoryFields
            category={category}
            onCategoryChange={handleCategoryChange}
            looktypeNumber={sharedLooktypeNumber}
            onLooktypeNumberChange={setSharedLooktypeNumber}
          />

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
              Desmarcado: sprites já existentes com o mesmo nome/número são puladas (ficam
              preservadas). Marcado: o cadastro existente é atualizado no lugar — mesmo id, com o
              nome e a sprite do arquivo — evitando cadastros duplicados.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Velocidade dos quadros (ms) — só afeta arquivos .obd animados</Label>
            <Input
              type="number"
              min={1}
              max={1000}
              value={frameSpeedMs}
              onChange={(event) => setFrameSpeedMs(Number(event.target.value))}
              className="w-32"
            />
          </div>

          {showReview && (
            <div className="flex flex-col gap-2">
              <Label>Revisar antes de salvar ({pendingFiles.length})</Label>
              <div ref={reviewScrollRef} className="h-72 overflow-y-auto rounded-md border border-border p-2">
                <div className="relative w-full" style={{ height: reviewVirtualizer.getTotalSize() }}>
                  {reviewVirtualizer.getVirtualItems().map((virtualRow) => {
                    const row = pendingFiles[virtualRow.index];
                    return (
                      <div
                        key={`${row.file.name}-${virtualRow.index}`}
                        className="absolute top-0 left-0 flex w-full items-center gap-2 pb-2"
                        style={{ height: virtualRow.size, transform: `translateY(${virtualRow.start}px)` }}
                      >
                        <span
                          className="w-40 shrink-0 truncate text-xs text-muted-foreground"
                          title={row.file.name}
                        >
                          {row.file.name}
                        </span>
                        <Input
                          value={row.name}
                          onChange={(event) => updatePendingFile(virtualRow.index, { name: event.target.value })}
                          placeholder="Nome"
                          className="flex-1"
                        />
                        {category !== "item" && (
                          <Input
                            type="number"
                            value={row.looktypeNumber ?? ""}
                            onChange={(event) =>
                              updatePendingFile(virtualRow.index, {
                                looktypeNumber: event.target.value === "" ? null : Number(event.target.value),
                              })
                            }
                            placeholder="Número"
                            className="w-24 shrink-0"
                          />
                        )}
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon-sm"
                          onClick={() => removePendingFile(virtualRow.index)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || pendingFiles.length === 0}>
              {isSubmitting
                ? progress
                  ? `Criando... (${progress.done}/${progress.total})`
                  : "Criando..."
                : `Criar${pendingFiles.length > 1 ? ` (${pendingFiles.length})` : ""}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
