import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { buildPaginatedResult, parseIdsParam, parsePaginationParams } from "@/lib/pagination";
import { withAudit } from "@/lib/api-audit-wrapper";

export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const url = new URL(request.url);

  const ids = parseIdsParam(url);
  if (ids) {
    const accountsById = await prisma.account.findMany({ where: { id: { in: ids } } });
    return NextResponse.json(buildPaginatedResult(accountsById, accountsById.length, 1, accountsById.length || 1));
  }

  const { page, pageSize, search } = parsePaginationParams(url);
  const groupId = url.searchParams.get("groupId");
  const blocked = url.searchParams.get("blocked");
  const status = url.searchParams.get("status");
  const premdaysBucket = url.searchParams.get("premdaysBucket");

  const premdaysFilter: Prisma.IntFilter | undefined =
    premdaysBucket === "1"
      ? { equals: 1 }
      : premdaysBucket === "2-14"
        ? { gte: 2, lte: 14 }
        : premdaysBucket === "15-30"
          ? { gte: 15, lte: 30 }
          : premdaysBucket === "30+"
            ? { gt: 30 }
            : status === "premium"
              ? { gt: 0 }
              : status === "free"
                ? { equals: 0 }
                : undefined;

  const where: Prisma.AccountWhereInput = {
    ...(search ? { name: { contains: search } } : {}),
    ...(groupId ? { groupId: Number(groupId) } : {}),
    ...(blocked === "true" || blocked === "false" ? { blocked: blocked === "true" } : {}),
    ...(premdaysFilter ? { premdays: premdaysFilter } : {}),
  };

  const [accounts, total] = await Promise.all([
    prisma.account.findMany({
      where,
      orderBy: { id: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        groupId: true,
        blocked: true,
        premdays: true,
        warnings: true,
        _count: { select: { players: true } },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.account.count({ where }),
  ]);

  return NextResponse.json(buildPaginatedResult(accounts, total, page, pageSize));
});
