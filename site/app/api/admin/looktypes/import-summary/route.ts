import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { withAudit } from "@/lib/api-audit-wrapper";

// Mesmo teto do diálogo de import (`MAX_FILES` em `LooktypeCreateDialog`) — limita o tamanho das
// listas de nomes gravadas no metadata, sem depender de o cliente já ter truncado.
const MAX_NAMES = 10000;

function toNameList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string").slice(0, MAX_NAMES);
}

/**
 * Registra em auditoria um resumo de UM lote de import de looktypes (ver
 * `LooktypeCreateDialog.handleSubmit`) — complementa os logs por arquivo já gravados
 * individualmente (`import_skip`/`import_error`, ver `POST /api/admin/looktypes` e
 * `.../import-log`), dando uma linha única e fácil de achar com a mesma contagem/lista de
 * arquivos que já aparece no toast ao final do import.
 */
export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const body = await request.json().catch(() => null);
  const batchId = typeof body?.batchId === "string" && body.batchId ? body.batchId : null;
  const category = typeof body?.category === "string" ? body.category : null;
  const createdCount = Number.isInteger(body?.createdCount) ? body.createdCount : 0;
  const updatedCount = Number.isInteger(body?.updatedCount) ? body.updatedCount : 0;
  const duplicateCount = Number.isInteger(body?.duplicateCount) ? body.duplicateCount : 0;
  const errorCount = Number.isInteger(body?.errorCount) ? body.errorCount : 0;
  const duplicateFileNames = toNameList(body?.duplicateFileNames);
  const errorFileNames = toNameList(body?.errorFileNames);

  if (createdCount === 0 && updatedCount === 0 && duplicateCount === 0 && errorCount === 0) {
    return NextResponse.json({ error: "Resumo vazio." }, { status: 422 });
  }

  await logAudit({
    accountId: Number(session.user.id),
    action: "import_summary",
    entity: "looktype",
    metadata: {
      batchId,
      category,
      createdCount,
      updatedCount,
      duplicateCount,
      errorCount,
      duplicateFileNames,
      errorFileNames,
    },
  });

  return NextResponse.json({ ok: true });
});
