import { NextResponse } from "next/server";

import { requireSiteAdminSession } from "@/lib/api-guard";
import { withAudit } from "@/lib/api-audit-wrapper";
import { InvalidServerPathError, listServerDirectory } from "@/lib/server-files";

export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireSiteAdminSession();
  if (response) return response;

  const url = new URL(request.url);
  const path = url.searchParams.get("path") ?? "";

  try {
    const entries = await listServerDirectory(path);
    return NextResponse.json({ entries });
  } catch (error) {
    if (error instanceof InvalidServerPathError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Pasta não encontrada." }, { status: 404 });
    }
    throw error;
  }
});
