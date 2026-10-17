import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { townFormSchema } from "@/lib/validations/admin/town";
import { townToFormInput } from "@/lib/town-mapper";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const GET = withAudit(async function GET(_request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const town = await prisma.town.findUnique({ where: { id: Number(id) } });

  if (!town) {
    return NextResponse.json({ error: "Town não encontrada." }, { status: 404 });
  }

  return NextResponse.json({ town: townToFormInput(town) });
});

export const PATCH = withAudit(async function PATCH(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const body = await request.json();
  const parsed = townFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const town = await prisma.town.update({
    where: { id: Number(id) },
    data: {
      name: parsed.data.name,
      templeX: parsed.data.templeX,
      templeY: parsed.data.templeY,
      templeZ: parsed.data.templeZ,
      published: parsed.data.published,
    },
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "town",
    entityId: town.id,
    metadata: { name: town.name },
  });

  return NextResponse.json({ town: townToFormInput(town) });
});

export const DELETE = withAudit(async function DELETE(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  await prisma.town.delete({ where: { id: Number(id) } });

  await logAudit({
    accountId: Number(session.user.id),
    action: "delete",
    entity: "town",
    entityId: id,
  });

  return NextResponse.json({ success: true });
});
