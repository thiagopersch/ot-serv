import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { withAudit } from "@/lib/api-audit-wrapper";

export const GET = withAudit(async function GET() {
  const { response } = await requireAdminSession();
  if (response) return response;

  const [categories, subcategories] = await Promise.all([
    prisma.monster.findMany({
      where: { category: { not: "" } },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    }),
    prisma.monster.findMany({
      where: { subcategory: { not: "" } },
      select: { subcategory: true },
      distinct: ["subcategory"],
      orderBy: { subcategory: "asc" },
    }),
  ]);

  return NextResponse.json({
    categories: categories.map((row) => row.category),
    subcategories: subcategories.map((row) => row.subcategory),
  });
});
