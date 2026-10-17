import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { withAudit } from "@/lib/api-audit-wrapper";

// Mesmo teto de arquivos por lote do diálogo de import (`MAX_FILES` em
// `LooktypeCreateDialog`) — o insert é feito em lote (`createMany`, ver abaixo), então o custo
// já não cresce por entrada e não há motivo para um teto menor aqui.
const MAX_ENTRIES = 10000;

type SkipEntry = {
  fileName: string;
  name: string;
  looktypeNumber: number | null;
  category: string;
  reason: string;
};

function isSkipEntry(value: unknown): value is SkipEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.fileName === "string" &&
    typeof entry.name === "string" &&
    typeof entry.category === "string" &&
    typeof entry.reason === "string" &&
    (entry.looktypeNumber === null || typeof entry.looktypeNumber === "number")
  );
}

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const body = await request.json().catch(() => null);
  const batchId = typeof body?.batchId === "string" && body.batchId ? body.batchId : null;
  const entries = Array.isArray(body?.entries) ? body.entries.filter(isSkipEntry).slice(0, MAX_ENTRIES) : [];

  if (entries.length === 0) {
    return NextResponse.json({ error: "Nenhuma entrada válida." }, { status: 422 });
  }

  // Insert em lote (1 query) em vez de N `logAudit` individuais — necessário pra lotes grandes
  // (até `MAX_ENTRIES` = MAX_FILES do diálogo) não abrirem milhares de inserts em paralelo.
  await prisma.auditLog.createMany({
    data: entries.map((entry: SkipEntry) => ({
      accountId: Number(session.user.id),
      action: "import_skip",
      entity: "looktype",
      metadata: { ...entry, batchId },
    })),
  });

  return NextResponse.json({ logged: entries.length });
});
