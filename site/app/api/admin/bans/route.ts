import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { buildPaginatedResult, parsePaginationParams } from "@/lib/pagination";
import { banSchema } from "@/lib/validations/admin/ban";
import { withAudit } from "@/lib/api-audit-wrapper";

export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const url = new URL(request.url);
  const { page, pageSize, search } = parsePaginationParams(url);
  const searchAsNumber = Number(search);
  const type = url.searchParams.get("type");
  const active = url.searchParams.get("active");
  const expiresState = url.searchParams.get("expiresState");
  const now = Math.floor(Date.now() / 1000);

  const where: Prisma.BanWhereInput = {
    ...(search
      ? {
          OR: [
            ...(Number.isFinite(searchAsNumber) ? [{ value: searchAsNumber }] : []),
            { comment: { contains: search } },
            { statement: { contains: search } },
          ],
        }
      : {}),
    ...(type ? { type: Number(type) } : {}),
    ...(active === "true" || active === "false" ? { active: active === "true" } : {}),
    ...(expiresState === "permanent"
      ? { expires: 0 }
      : expiresState === "active"
        ? { expires: { gt: now } }
        : expiresState === "expired"
          ? { expires: { gt: 0, lte: now } }
          : {}),
  };

  const [bans, total] = await Promise.all([
    prisma.ban.findMany({
      where,
      orderBy: { id: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.ban.count({ where }),
  ]);

  return NextResponse.json(buildPaginatedResult(bans, total, page, pageSize));
});

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const body = await request.json();
  const parsed = banSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const ban = await prisma.ban.create({
    data: {
      ...parsed.data,
      added: Math.floor(Date.now() / 1000),
      adminId: Number(session.user.id),
    },
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "create",
    entity: "ban",
    entityId: ban.id,
    metadata: { value: ban.value, type: ban.type },
  });

  return NextResponse.json({ ban }, { status: 201 });
});
