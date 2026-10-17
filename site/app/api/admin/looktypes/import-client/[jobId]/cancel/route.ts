import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { withAudit } from "@/lib/api-audit-wrapper";
import { requestCancel } from "@/lib/tibia-client/import-job-store";

type Params = { params: Promise<{ jobId: string }> };

export const POST = withAudit(async function POST(_request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { jobId } = await params;
  const cancelled = requestCancel(jobId);
  if (!cancelled) {
    return NextResponse.json({ error: "Import não encontrado ou já finalizado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
});
