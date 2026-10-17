import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { extOutfitSchema } from "@/lib/validations/admin/extoutfit";
import { extOutfitInclude, extOutfitInputToPrismaData, extOutfitToRow } from "@/lib/extoutfit-mapper";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const GET = withAudit(async function GET(_request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const entry = await prisma.extOutfit.findUnique({ where: { id: Number(id) }, include: extOutfitInclude });
  if (!entry) {
    return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ extOutfit: extOutfitToRow(entry) });
});

export const PATCH = withAudit(async function PATCH(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const parsed = extOutfitSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 422 });
  }

  const conflict = await prisma.extOutfit.findFirst({
    where: { kind: parsed.data.kind, xmlId: parsed.data.xmlId, id: { not: Number(id) } },
  });
  if (conflict) {
    return NextResponse.json(
      { error: `Já existe <${parsed.data.kind}> com o id ${parsed.data.xmlId}.` },
      { status: 409 },
    );
  }

  const entry = await prisma.extOutfit.update({
    where: { id: Number(id) },
    data: extOutfitInputToPrismaData(parsed.data),
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "extoutfit",
    entityId: entry.id,
    metadata: { kind: entry.kind, xmlId: entry.xmlId, name: entry.name },
  });

  return NextResponse.json({ extOutfit: entry });
});

export const DELETE = withAudit(async function DELETE(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  await prisma.extOutfit.delete({ where: { id: Number(id) } });
  await prisma.entityImage.deleteMany({ where: { entityType: "extoutfit", entityId: Number(id) } });

  await logAudit({
    accountId: Number(session.user.id),
    action: "delete",
    entity: "extoutfit",
    entityId: id,
  });

  return NextResponse.json({ success: true });
});
