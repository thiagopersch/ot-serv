import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { borderFormSchema } from "@/lib/validations/admin/border";
import { borderToFormInput } from "@/lib/border-mapper";
import { hasDuplicateName } from "@/lib/unique-name";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const GET = withAudit(async function GET(_request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const border = await prisma.border.findUnique({ where: { id: Number(id) } });

  if (!border) {
    return NextResponse.json({ error: "Border não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ border: borderToFormInput(border) });
});

export const PATCH = withAudit(async function PATCH(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const body = await request.json();
  const parsed = borderFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const existingNames = await prisma.border.findMany({ select: { id: true, name: true } });
  if (hasDuplicateName(existingNames, parsed.data.name, Number(id))) {
    return NextResponse.json({ error: "Já existe um border com esse nome." }, { status: 409 });
  }

  const border = await prisma.border.update({
    where: { id: Number(id) },
    data: {
      name: parsed.data.name,
      group: parsed.data.group,
      optional: parsed.data.optional,
      edges: parsed.data.edges,
    },
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "border",
    entityId: border.id,
    metadata: { name: border.name },
  });

  return NextResponse.json({ border: borderToFormInput(border) });
});

export const DELETE = withAudit(async function DELETE(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  await prisma.border.delete({ where: { id: Number(id) } });

  await logAudit({
    accountId: Number(session.user.id),
    action: "delete",
    entity: "border",
    entityId: id,
  });

  return NextResponse.json({ success: true });
});
