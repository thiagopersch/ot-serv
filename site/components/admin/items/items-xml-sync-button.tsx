"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ItemsXmlSyncButtonProps = {
  onSynced: () => void;
};

type SyncState =
  | { status: "confirm" }
  | { status: "running"; percent: number; processed: number; total: number }
  | { status: "done"; total: number }
  | { status: "error"; message: string; hint: string; stage?: string };

const STAGE_LABEL: Record<string, string> = {
  config: "Configuração",
  database: "Leitura do banco de dados",
  file: "Gravação do arquivo",
};

/** Sobrescreve o `items.xml` do disco com os dados do banco — ver `syncItemsXmlFromDatabase` e
 * `/api/admin/items/sync-xml`, que responde em NDJSON com o progresso. Pede confirmação antes, pois o
 * conteúdo atual do arquivo é substituído por completo. */
export function ItemsXmlSyncButton({ onSynced }: ItemsXmlSyncButtonProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<SyncState>({ status: "confirm" });

  const isRunning = state.status === "running";

  function handleOpenChange(next: boolean) {
    if (isRunning) return;
    setOpen(next);
    if (next) setState({ status: "confirm" });
  }

  async function handleSync() {
    setState({ status: "running", percent: 0, processed: 0, total: 0 });

    try {
      const response = await fetch("/api/admin/items/sync-xml", { method: "POST" });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null);
        setState({
          status: "error",
          message: data?.error ?? "O servidor recusou a sincronização.",
          hint: "Aguarde alguns instantes e tente novamente.",
        });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;

      const handleLine = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line);

        if (event.type === "progress") {
          setState({ status: "running", percent: event.percent, processed: event.processed, total: event.total });
        } else if (event.type === "done") {
          finished = true;
          setState({ status: "done", total: event.total });
          toast.success(`items.xml sincronizado: ${event.total} item(ns) gravado(s).`);
          onSynced();
        } else if (event.type === "error") {
          finished = true;
          setState({ status: "error", message: event.message, hint: event.hint, stage: event.stage });
        }
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        lines.forEach(handleLine);
      }
      handleLine(buffer);

      if (!finished) {
        setState({
          status: "error",
          message: "A conexão com o servidor foi interrompida antes do fim da sincronização.",
          hint: "Verifique se o portal continua rodando e tente novamente. O items.xml só é trocado quando a gravação termina.",
        });
      }
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Erro inesperado ao sincronizar.",
        hint: "Verifique a conexão com o servidor e tente novamente.",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <RefreshCw className="size-4" />
            Sincronizar items.xml
          </Button>
        }
      />
      <DialogContent showCloseButton={!isRunning}>
        <DialogHeader>
          <DialogTitle>Sincronizar items.xml</DialogTitle>
          <DialogDescription>
            {state.status === "confirm" &&
              "Os items salvos no banco de dados serão sincronizados com o items.xml do disco. Todo o conteúdo atual do arquivo será sobrescrito pelos dados do banco. Deseja continuar?"}
            {state.status === "running" && "Gravando o items.xml. Não feche esta janela até o fim do processo."}
            {state.status === "done" && "Sincronização concluída."}
            {state.status === "error" && "A sincronização foi interrompida e o items.xml original não foi alterado."}
          </DialogDescription>
        </DialogHeader>

        {state.status === "running" && (
          <div className="flex flex-col gap-2">
            <Progress value={state.percent} />
            <p className="text-muted-foreground text-sm">
              {state.percent}% — {state.processed}/{state.total} item(ns)
            </p>
          </div>
        )}

        {state.status === "done" && (
          <div className="flex flex-col gap-2">
            <Progress value={100} />
            <p className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-green-600" />
              100% — {state.total} item(ns) gravado(s) no items.xml.
            </p>
          </div>
        )}

        {state.status === "error" && (
          <div className="flex flex-col gap-2 text-sm">
            <p className="text-destructive flex items-start gap-2 font-medium">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {state.stage ? `${STAGE_LABEL[state.stage] ?? state.stage}: ` : ""}
              {state.message}
            </p>
            <p>
              <span className="font-medium">Como resolver:</span> {state.hint}
            </p>
            <p className="text-muted-foreground">Este erro foi registrado nos logs de auditoria.</p>
          </div>
        )}

        <DialogFooter>
          {state.status === "confirm" && (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSync}>Confirmar e sincronizar</Button>
            </>
          )}
          {state.status === "error" && (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Fechar
              </Button>
              <Button onClick={handleSync}>Tentar novamente</Button>
            </>
          )}
          {state.status === "done" && <Button onClick={() => setOpen(false)}>Fechar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
