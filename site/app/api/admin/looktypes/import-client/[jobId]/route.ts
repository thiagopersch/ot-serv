import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { withAudit } from "@/lib/api-audit-wrapper";
import { getJob } from "@/lib/tibia-client/import-job-store";

type Params = { params: Promise<{ jobId: string }> };

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
