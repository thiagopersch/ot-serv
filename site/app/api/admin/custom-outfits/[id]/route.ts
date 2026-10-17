import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { withAudit } from "@/lib/api-audit-wrapper";
import { customOutfitSchema } from "@/lib/validations/admin/custom-outfit";
import { trySyncCustomOutfits } from "@/lib/custom-outfit-sync";

type Params = { params: Promise<{ id: string }> };

async function parseId(params: Params["params"]) {
  const id = Number((await params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export const PATCH = withAudit(async function PATCH(
  request: Request,
  { params }: Params,
) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const id = await parseId(params);
  if (!id) return NextResponse.json({ error: "Id inválido." }, { status: 400 });

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
  if (duplicate && duplicate.id !== id) {
    return NextResponse.json(
      {
        error: `O item #${parsed.data.itemId} já libera o outfit "${duplicate.name}".`,
      },
      { status: 409 },
    );
  }

  const outfit = await prisma.customOutfit.update({
    where: { id },
    data: parsed.data,
  });
  const syncError = await trySyncCustomOutfits();

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "custom_outfit",
    entityId: String(id),
    metadata: { ...parsed.data },
  });

  return NextResponse.json({ outfit, syncError });
});

export const DELETE = withAudit(async function DELETE(
  _request: Request,
  { params }: Params,
) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const id = await parseId(params);
  if (!id) return NextResponse.json({ error: "Id inválido." }, { status: 400 });

  await prisma.customOutfit.delete({ where: { id } });
  const syncError = await trySyncCustomOutfits();

  await logAudit({
    accountId: Number(session.user.id),
    action: "delete",
    entity: "custom_outfit",
    entityId: String(id),
  });

  return NextResponse.json({ ok: true, syncError });
});
