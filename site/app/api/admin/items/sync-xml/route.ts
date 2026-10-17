import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { SyncItemsXmlError, syncItemsXmlFromDatabase } from "@/lib/items-xml-sync";
import { withAudit } from "@/lib/api-audit-wrapper";

/** Impede duas sincronizações simultâneas gravando o mesmo arquivo; em `globalThis` para sobreviver
 * ao HMR do dev server. */
const globalForSync = globalThis as unknown as { itemsXmlSyncRunning?: boolean };

/**
 * Ação manual disparada pelo dialog "Sincronizar items.xml" (Processos): sobrescreve o arquivo do
 * disco com os dados do banco — ver `syncItemsXmlFromDatabase`. Responde em NDJSON (uma linha JSON
 * por evento) para o dialog exibir a barra de progresso:
 * `{type:"progress",percent,processed,total}` → `{type:"done",total}` | `{type:"error",stage,message,hint}`.
 */
export const POST = withAudit(async function POST() {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  if (globalForSync.itemsXmlSyncRunning) {
    return NextResponse.json({ error: "Já existe uma sincronização do items.xml em andamento." }, { status: 409 });
  }
  globalForSync.itemsXmlSyncRunning = true;

  const accountId = Number(session.user.id);
  const startedAt = Date.now();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          // cliente fechou a conexão — a sincronização continua até o fim mesmo assim
        }
      };

      try {
        const result = await syncItemsXmlFromDatabase((progress) => send({ type: "progress", ...progress }));

        await logAudit({
          accountId,
          action: "sync-xml",
          entity: "item",
          metadata: { total: result.total, durationMs: Date.now() - startedAt },
        });
        send({ type: "done", total: result.total });
      } catch (error) {
        const known = error instanceof SyncItemsXmlError ? error : null;
        const message = known?.message ?? (error instanceof Error ? error.message : String(error));
        const hint = known?.hint ?? "Consulte o log do servidor para mais detalhes e tente novamente.";
        const errorStage = known?.stage ?? "file";

        await logAudit({
          accountId,
          action: "sync-xml-failed",
          entity: "item",
          metadata: { stage: errorStage, message, hint, processed: known?.processed ?? 0 },
        }).catch(() => undefined);
        send({ type: "error", stage: errorStage, message, hint });
      } finally {
        globalForSync.itemsXmlSyncRunning = false;
        try {
          controller.close();
        } catch {
          // já fechado
        }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
});
