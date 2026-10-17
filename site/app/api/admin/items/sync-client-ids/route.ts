import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { type OtbItemEntry, parseItemsOtb } from "@/lib/items-otb/items-otb-parser";
import { syncItemClientIdsFromOtb } from "@/lib/item-mapper";
import { withAudit } from "@/lib/api-audit-wrapper";

/**
 * Recebe um `items.otb` (formato binário do engine, ver `lib/items-otb/items-otb-parser.ts`),
 * lê o mapeamento server_id/client_id que ele carrega e sincroniza os items já cadastrados
 * (preenche `clientId` só onde está vazio, vincula looktype automaticamente a partir dele quando
 * ainda não há uma vinculada — ver `syncItemClientIdsFromOtb`). Nunca falha "de sincronismo" por
 * entradas sem correspondência: essas só são contadas em `otbEntriesSkipped`. Falhas reais
 * (arquivo inválido, erro de banco) são logadas em auditoria e devolvidas como erro não-fatal.
 */
export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 422 });
  }

  let entries: OtbItemEntry[];
  try {
    entries = parseItemsOtb(Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    await logAudit({
      accountId: Number(session.user.id),
      action: "otb-verify-failed",
      entity: "item",
      metadata: {
        fileName: file.name,
        reason: "otb parse failed",
        error: error instanceof Error ? error.message : String(error),
      },
    });
    return NextResponse.json(
      { error: "Não foi possível ler o arquivo items.otb. Verifique se é um arquivo válido." },
      { status: 422 }
    );
  }

  if (entries.length === 0) {
    await logAudit({
      accountId: Number(session.user.id),
      action: "otb-verify-failed",
      entity: "item",
      metadata: { fileName: file.name, reason: "no entries found" },
    });
    return NextResponse.json(
      { error: "Nenhum item com client id encontrado no arquivo." },
      { status: 422 }
    );
  }

  // Log de verificação do .otb — sempre gravado após um parse bem-sucedido, antes de tocar no
  // banco, independente do resultado da sincronização em si (que ganha seu próprio log abaixo).
  await logAudit({
    accountId: Number(session.user.id),
    action: "otb-verify",
    entity: "item",
    metadata: { fileName: file.name, otbEntriesTotal: entries.length },
  });

  try {
    const result = await syncItemClientIdsFromOtb(prisma, entries);

    await logAudit({
      accountId: Number(session.user.id),
      action: "import",
      entity: "item",
      metadata: { source: "items.otb", fileName: file.name, ...result, otbEntriesTotal: entries.length },
    });

    return NextResponse.json(result);
  } catch (error) {
    await logAudit({
      accountId: Number(session.user.id),
      action: "import-failed",
      entity: "item",
      metadata: {
        source: "items.otb",
        fileName: file.name,
        reason: "db update failed",
        error: error instanceof Error ? error.message : String(error),
      },
    });
    return NextResponse.json({ error: "Falha ao sincronizar client ids. Tente novamente." }, { status: 500 });
  }
});
