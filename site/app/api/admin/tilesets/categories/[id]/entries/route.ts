import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { tilesetItemEntryFormSchema } from "@/lib/validations/admin/tileset";
import { tilesetItemEntryToFormInput } from "@/lib/tileset-mapper";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const GET = withAudit(async function GET(_request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const entries = await prisma.tilesetItemEntry.findMany({
    where: { categoryId: Number(id) },
    orderBy: { order: "asc" },
  });

  return NextResponse.json({ entries: entries.map(tilesetItemEntryToFormInput) });
});

export const POST = withAudit(async function POST(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const categoryId = Number(id);
  const body = await request.json();
  const parsed = tilesetItemEntryFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const category = await prisma.tilesetCategory.findUnique({ where: { id: categoryId }, select: { id: true, type: true } });
  if (!category) {
    return NextResponse.json({ error: "Categoria não encontrada." }, { status: 404 });
  }

  // Categorias BRUSH (terrain/doodad) também podem ter entradas de item soltas — o RME já
  // mistura `<brush>` e `<item>` na mesma tag (ex.: `doodad`, `terrain_and_raw`); ver
  // `tilesetCategoryToXmlCategory` em lib/tileset-mapper.ts.
  const entry = await prisma.tilesetItemEntry.create({
    data: {
      categoryId,
      order: parsed.data.order,
      kind: parsed.data.kind,
      itemId: parsed.data.itemId,
      fromId: parsed.data.fromId,
      toId: parsed.data.toId,
    },
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "create",
    entity: "tileset_item_entry",
    entityId: entry.id,
    metadata: { categoryId, kind: entry.kind },
  });

  return NextResponse.json({ entry: tilesetItemEntryToFormInput(entry) }, { status: 201 });
});
