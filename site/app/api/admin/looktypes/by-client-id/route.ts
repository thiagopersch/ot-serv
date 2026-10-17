import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { findItemLooktypeByClientId } from "@/lib/looktype-lookup";
import { withAudit } from "@/lib/api-audit-wrapper";

/**
 * Resolve a looktype de item (`category="item"`) cujo nome referencia o `clientId` informado
 * (convenção `item_{clientId}`). Usado pelo form de item para auto-vincular `lookTypeId` assim
 * que o admin preenche o client id do sprite (`.otb`/items.xml). Nunca retorna erro de
 * "sincronismo" por não encontrar — `found: false` é uma resposta 200 normal, o form decide
 * pedir o preenchimento manual. Uma falha inesperada (ex.: banco indisponível) é registrada no
 * log de auditoria e ainda assim devolve `found: false`, sem travar o admin.
 */
export const GET = withAudit(async function GET(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const url = new URL(request.url);
  const clientId = Number(url.searchParams.get("clientId"));

  if (!Number.isInteger(clientId) || clientId < 1) {
    return NextResponse.json({ error: "Informe um client id válido." }, { status: 422 });
  }

  try {
    const looktype = await findItemLooktypeByClientId(prisma, clientId);

    if (!looktype) {
      return NextResponse.json({ found: false, looktype: null });
    }

    return NextResponse.json({ found: true, looktype });
  } catch (error) {
    await logAudit({
      accountId: Number(session.user.id),
      action: "lookup-failed",
      entity: "looktype",
      metadata: {
        clientId,
        reason: "by-client-id lookup",
        error: error instanceof Error ? error.message : String(error),
      },
    });

    return NextResponse.json({ found: false, looktype: null });
  }
});
