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
  const source = await prisma.tileset.findUnique({
    where: { id: Number(id) },
    include: { categories: { orderBy: { order: "asc" } } },
  });

  if (!source) {
    return NextResponse.json({ error: "Tileset não encontrado." }, { status: 404 });
  }

  const name = await uniqueCopyName(
    source.name,
    async (candidate) =>
      (await prisma.tileset.findUnique({ where: { name: candidate }, select: { id: true } })) != null,
  );

  const tileset = await prisma.tileset.create({
    data: {
      name,
      description: source.description,
      order: source.order,
      active: source.active,
      icon: source.icon,
      categories: {
        create: source.categories.map((category) => ({
          name: category.name,
          kind: category.kind,
          type: category.type,
          order: category.order,
          description: category.description,
        })),
      },
    },
    include: { _count: { select: { categories: true } } },
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "duplicate",
    entity: "tileset",
    entityId: tileset.id,
    metadata: { sourceId: source.id, name: tileset.name },
  });

  return NextResponse.json({ id: tileset.id, name: tileset.name }, { status: 201 });
});
