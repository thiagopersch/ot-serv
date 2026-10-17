import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { buildPaginatedResult, parsePaginationParams } from "@/lib/pagination";
import { donationSchema } from "@/lib/validations/admin/donation";
import { withAudit } from "@/lib/api-audit-wrapper";

export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const url = new URL(request.url);
  const { page, pageSize, search } = parsePaginationParams(url);

  const where: Prisma.DonationWhereInput = search
    ? { account: { name: { contains: search } } }
    : {};

  const [entries, total] = await Promise.all([
    prisma.donation.findMany({
      where,
      orderBy: { id: "desc" },
      include: { account: { select: { name: true } } },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.donation.count({ where }),
  ]);

  return NextResponse.json(
    buildPaginatedResult(
      entries.map((entry) => ({ ...entry, amount: entry.amount.toString() })),
      total,
      page,
      pageSize,
    ),
  );
});

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const body = await request.json();
  const parsed = donationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const account = await prisma.account.findUnique({ where: { name: parsed.data.accountName } });
  if (!account) {
    return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
  }

  const entry = await prisma.donation.create({
    data: { accountId: account.id, amount: parsed.data.amount, note: parsed.data.note || null },
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "create",
    entity: "donation",
    entityId: entry.id,
    metadata: { accountName: account.name, amount: parsed.data.amount },
  });

  return NextResponse.json({ entry: { ...entry, amount: entry.amount.toString() } }, { status: 201 });
});
