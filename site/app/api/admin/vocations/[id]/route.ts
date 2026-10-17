import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { vocationSchema } from "@/lib/validations/admin/vocation";
import { vocationInputToPrismaData, vocationToInput } from "@/lib/vocation-mapper";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const GET = withAudit(async function GET(_request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const vocation = await prisma.vocation.findUnique({ where: { id: Number(id) } });

  if (!vocation) {
    return NextResponse.json({ error: "Vocação não encontrada." }, { status: 404 });
  }

  return NextResponse.json({ vocation: vocationToInput(vocation) });
});

export const PATCH = withAudit(async function PATCH(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const body = await request.json();
  const parsed = vocationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const { id: vocationId, ...data } = vocationInputToPrismaData(parsed.data);
  void vocationId;

  const vocation = await prisma.vocation.update({
    where: { id: Number(id) },
    data,
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "vocation",
    entityId: vocation.id,
    metadata: { name: vocation.name },
  });

  return NextResponse.json({ vocation: vocationToInput(vocation) });
});

export const DELETE = withAudit(async function DELETE(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  await prisma.vocation.delete({ where: { id: Number(id) } });

  await logAudit({
    accountId: Number(session.user.id),
    action: "delete",
    entity: "vocation",
    entityId: id,
  });

  return NextResponse.json({ success: true });
});
