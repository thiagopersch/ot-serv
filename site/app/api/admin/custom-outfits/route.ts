import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { withAudit } from "@/lib/api-audit-wrapper";
import { trySyncCustomOutfits } from "@/lib/custom-outfit-sync";
import { customOutfitSchema } from "@/lib/validations/admin/custom-outfit";

export const GET = withAudit(async function GET() {
  const { response } = await requireAdminSession();
  if (response) return response;

  const outfits = await prisma.customOutfit.findMany({
    orderBy: { id: "asc" },
  });
  return NextResponse.json({ outfits });
});

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const parsed = customOutfitSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 422 },
    );
  }

  const duplicate = await prisma.customOutfit.findUnique({
    where: { itemId: parsed.data.itemId },
  });
  if (duplicate) {
    return NextResponse.json(
      {
        error: `O item #${parsed.data.itemId} já libera o outfit "${duplicate.name}".`,
      },
      { status: 409 },
    );
  }

  const outfit = await prisma.customOutfit.create({ data: parsed.data });
  const syncError = await trySyncCustomOutfits();

  await logAudit({
    accountId: Number(session.user.id),
    action: "create",
    entity: "custom_outfit",
    entityId: String(outfit.id),
    metadata: { ...parsed.data },
  });

  return NextResponse.json({ outfit, syncError }, { status: 201 });
});
