import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { withAudit } from "@/lib/api-audit-wrapper";

export const GET = withAudit(async function GET() {
  const { response } = await requireAdminSession();
  if (response) return response;

  const rows = await prisma.looktype.findMany({
    select: { frameCount: true, width: true, height: true, frameDurationsMs: true },
  });

  const frameCounts = Array.from(new Set(rows.map((row) => row.frameCount))).sort((a, b) => a - b);

  const sizeMap = new Map<string, { width: number; height: number }>();
  for (const row of rows) {
    sizeMap.set(`${row.width}x${row.height}`, { width: row.width, height: row.height });
  }
  const sizes = Array.from(sizeMap.values()).sort((a, b) => a.width - b.width || a.height - b.height);

  const speeds = Array.from(
    new Set(
      rows
        .map((row) => (row.frameDurationsMs as number[])?.[0])
        .filter((value): value is number => typeof value === "number"),
    ),
  ).sort((a, b) => a - b);

  return NextResponse.json({ frameCounts, sizes, speeds });
});
