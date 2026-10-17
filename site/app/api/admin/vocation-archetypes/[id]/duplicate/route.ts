import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { uniqueCopyName } from "@/lib/duplicate-utils";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const POST = withAudit(async function POST(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const source = await prisma.vocationArchetype.findUnique({ where: { id: Number(id) } });

  if (!source) {
    return NextResponse.json({ error: "Arquétipo não encontrado." }, { status: 404 });
  }

  const name = await uniqueCopyName(
    source.name,
    async (candidate) =>
      (await prisma.vocationArchetype.findUnique({ where: { name: candidate }, select: { id: true } })) != null,
  );

  const vocationArchetype = await prisma.vocationArchetype.create({ data: { name } });

  await logAudit({
    accountId: Number(session.user.id),
    action: "duplicate",
    entity: "vocation_archetype",
    entityId: vocationArchetype.id,
    metadata: { sourceId: source.id, name: vocationArchetype.name },
  });

  return NextResponse.json({ id: vocationArchetype.id, name: vocationArchetype.name }, { status: 201 });
});
