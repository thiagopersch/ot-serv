import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { houseUpdateSchema } from "@/lib/validations/admin/house";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const GET = withAudit(async function GET(_request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const house = await prisma.house.findFirst({
    where: { id: Number(id) },
    include: { houseAuction: { include: { player: { select: { id: true, name: true } } } } },
  });

  if (!house) {
    return NextResponse.json({ error: "House não encontrada." }, { status: 404 });
  }

  const owner = house.owner > 0 ? await prisma.player.findUnique({ where: { id: house.owner }, select: { id: true, name: true } }) : null;

  return NextResponse.json({ house, owner });
});

export const PATCH = withAudit(async function PATCH(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const body = await request.json();
  const parsed = houseUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 422 }
    );
  }

  const existing = await prisma.house.findFirst({ where: { id: Number(id) } });
  if (!existing) {
    return NextResponse.json({ error: "House não encontrada." }, { status: 404 });
  }

  if (parsed.data.owner > 0) {
    const owner = await prisma.player.findUnique({ where: { id: parsed.data.owner } });
    if (!owner) {
      return NextResponse.json({ error: "Dono informado não existe." }, { status: 422 });
    }
  }

  const house = await prisma.house.update({
    where: { id_worldId: { id: existing.id, worldId: existing.worldId } },
    data: parsed.data,
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "house",
    entityId: house.id,
    metadata: { name: house.name },
  });

  return NextResponse.json({ house });
});
