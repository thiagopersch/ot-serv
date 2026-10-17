import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { buildPaginatedResult, parsePaginationParams } from "@/lib/pagination";
import { withAudit } from "@/lib/api-audit-wrapper";

export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const url = new URL(request.url);
  const { page, pageSize, search } = parsePaginationParams(url);

  const where: Prisma.GuildWhereInput = search ? { name: { contains: search } } : {};

  const [guilds, total] = await Promise.all([
    prisma.guild.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        owner: { select: { id: true, name: true } },
        _count: { select: { ranks: true, invites: true } },
      },
    }),
    prisma.guild.count({ where }),
  ]);

  const data = guilds.map(({ _count, ...guild }) => ({
    ...guild,
    rankCount: _count.ranks,
    inviteCount: _count.invites,
  }));

  return NextResponse.json(buildPaginatedResult(data, total, page, pageSize));
});
