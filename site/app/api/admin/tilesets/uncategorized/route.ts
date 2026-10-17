import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { withAudit } from "@/lib/api-audit-wrapper";

export const GET = withAudit(async function GET() {
  const { response } = await requireAdminSession();
  if (response) return response;

  const [grounds, walls, doodads] = await Promise.all([
    prisma.ground.findMany({ where: { tilesetCategoryId: null }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }),
    prisma.wallBrush.findMany({ where: { tilesetCategoryId: null }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }),
    prisma.doodadBrush.findMany({ where: { tilesetCategoryId: null }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }),
  ]);

  return NextResponse.json({ grounds, walls, doodads });
});
