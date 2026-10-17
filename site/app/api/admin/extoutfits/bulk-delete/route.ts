import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { withAudit } from "@/lib/api-audit-wrapper";

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const body: unknown = await request.json().catch(() => null);
  const rawIds = body && typeof body === "object" && "ids" in body ? (body as { ids: unknown }).ids : null;
  const ids = Array.isArray(rawIds) ? rawIds.filter((value): value is number => Number.isInteger(value)) : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "Nenhum id válido informado." }, { status: 422 });
  }

  const { count } = await prisma.extOutfit.deleteMany({ where: { id: { in: ids } } });
  await prisma.entityImage.deleteMany({ where: { entityType: "extoutfit", entityId: { in: ids } } });

  await logAudit({
    accountId: Number(session.user.id),
    action: "bulk_delete",
    entity: "extoutfit",
    metadata: { deletedCount: count, ids: ids.slice(0, 2000) },
  });

  return NextResponse.json({ deletedCount: count });
});
