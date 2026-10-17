import { promises as fs } from "node:fs";

import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { withAudit } from "@/lib/api-audit-wrapper";
import { looktypeFrameDirPath } from "@/lib/looktype-storage";
import { findLinkedLooktypeIds } from "@/lib/looktype-usage";

const MAX_IDS = 20000;
const CHUNK_SIZE = 2000;
// Mesmo teto do metadata de auditoria dos outros endpoints de import em lote (`import-summary`) —
// evita gravar uma lista gigante de ids numa única linha de `audit_logs`.
const MAX_IDS_IN_AUDIT = 2000;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const body: unknown = await request.json().catch(() => null);
  const rawIds = body && typeof body === "object" && "ids" in body ? (body as { ids: unknown }).ids : null;
  const ids: number[] = Array.isArray(rawIds)
    ? rawIds.filter((value): value is number => Number.isInteger(value)).slice(0, MAX_IDS)
    : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "Nenhum id válido informado." }, { status: 422 });
  }

  // Nunca apaga um looktype vinculado a algo (item/monstro/npc/vocação/spell) — só reporta que foi
  // pulado, pra não quebrar a referência de quem já aponta pra ele.
  const linkedIds = await findLinkedLooktypeIds(ids);
  const skippedIds = ids.filter((id: number) => linkedIds.has(id));
  const deletableIds = ids.filter((id: number) => !linkedIds.has(id));

  for (const idsChunk of chunk(deletableIds, CHUNK_SIZE)) {
    await prisma.looktype.deleteMany({ where: { id: { in: idsChunk } } });
  }

  // Remoção de frames em disco é best-effort — uma falha pontual de I/O não deve impedir o
  // restante nem reverter a exclusão já confirmada no banco.
  await Promise.all(deletableIds.map((id: number) => fs.rm(looktypeFrameDirPath(id), { recursive: true, force: true }).catch(() => null)));

  await logAudit({
    accountId: Number(session.user.id),
    action: "bulk_delete",
    entity: "looktype",
    metadata: {
      deletedCount: deletableIds.length,
      skippedCount: skippedIds.length,
      deletedIds: deletableIds.slice(0, MAX_IDS_IN_AUDIT),
      skippedIds: skippedIds.slice(0, MAX_IDS_IN_AUDIT),
    },
  });

  return NextResponse.json({ deletedCount: deletableIds.length, skippedCount: skippedIds.length, skippedIds });
});
