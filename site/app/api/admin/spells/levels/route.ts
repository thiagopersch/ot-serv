import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { withAudit } from "@/lib/api-audit-wrapper";

export const GET = withAudit(async function GET() {
  const { response } = await requireAdminSession();
  if (response) return response;

  const rows = await prisma.spell.findMany({
    distinct: ["level"],
    select: { level: true },
    orderBy: { level: "asc" },
  });

  return NextResponse.json({ levels: rows.map((row) => row.level) });
});
