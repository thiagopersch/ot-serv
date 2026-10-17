import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { getJob } from "@/lib/monster/import-job-store";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ jobId: string }> };

/** Consulta o progresso de um import de monstros em andamento (polling da UI). */
export const GET = withAudit(async function GET(_request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Import não encontrado (processo pode ter reiniciado)." }, { status: 404 });
  }

  return NextResponse.json({ job });
});