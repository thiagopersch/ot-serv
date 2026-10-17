import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { sha1 } from "@/lib/crypto";
import { accountUpdateSchema } from "@/lib/validations/admin/account";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const GET = withAudit(async function GET(_request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const account = await prisma.account.findUnique({
    where: { id: Number(id) },
    select: {
      id: true,
      name: true,
      email: true,
      groupId: true,
      blocked: true,
      premdays: true,
      warnings: true,
    },
  });

  if (!account) {
    return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
  }

  return NextResponse.json({ account: { ...account, password: "" } });
});

export const PATCH = withAudit(async function PATCH(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const body = await request.json();
  const parsed = accountUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 422 }
    );
  }

  const duplicate = await prisma.account.findFirst({
    where: { name: parsed.data.name, NOT: { id: Number(id) } },
  });
  if (duplicate) {
    return NextResponse.json({ error: "Já existe uma conta com esse nome." }, { status: 409 });
  }

  const { password, ...rest } = parsed.data;

  const account = await prisma.account.update({
    where: { id: Number(id) },
    data: {
      ...rest,
      ...(password ? { password: sha1(password) } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      groupId: true,
      blocked: true,
      premdays: true,
      warnings: true,
    },
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "account",
    entityId: account.id,
    metadata: { ...rest, passwordChanged: Boolean(password) },
  });

  return NextResponse.json({ account: { ...account, password: "" } });
});
