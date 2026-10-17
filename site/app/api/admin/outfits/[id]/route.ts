import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { outfitSchema } from "@/lib/validations/admin/outfit";
import { outfitInclude, outfitInputToPrismaData, outfitsToRows } from "@/lib/outfit-mapper";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const GET = withAudit(async function GET(_request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const outfit = await prisma.outfitDefinition.findUnique({ where: { id: Number(id) }, include: outfitInclude });
  if (!outfit) {
    return NextResponse.json({ error: "Outfit não encontrada." }, { status: 404 });
  }

  const [row] = await outfitsToRows(prisma, [outfit]);
  return NextResponse.json({ outfit: row });
});

export const PATCH = withAudit(async function PATCH(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const parsed = outfitSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 422 });
  }

  const existing = await prisma.outfitDefinition.findUnique({ where: { id: Number(id) } });
  if (!existing) {
    return NextResponse.json({ error: "Outfit não encontrada." }, { status: 404 });
  }

  const { id: outfitId, ...data } = outfitInputToPrismaData(parsed.data);
  void outfitId;

  const outfit = await prisma.outfitDefinition.update({ where: { id: Number(id) }, data });

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "outfit",
    entityId: outfit.id,
    metadata: { name: outfit.name },
  });

  return NextResponse.json({ outfit });
});

export const DELETE = withAudit(async function DELETE(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  await prisma.outfitDefinition.delete({ where: { id: Number(id) } });

  await logAudit({
    accountId: Number(session.user.id),
    action: "delete",
    entity: "outfit",
    entityId: id,
  });

  return NextResponse.json({ success: true });
});
