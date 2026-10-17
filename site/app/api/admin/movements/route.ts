import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { buildPaginatedResult, parsePaginationParams } from "@/lib/pagination";
import { movementSchema } from "@/lib/validations/admin/movement";
import { movementFormToRow, movementMatchesItemId, movementRowToFormInput } from "@/lib/movement-mapper";
import { withAudit } from "@/lib/api-audit-wrapper";

const MOVEMENT_INCLUDE = { vocations: { select: { vocationId: true } } } as const;

export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const url = new URL(request.url);
  const itemIdParam = url.searchParams.get("itemId");

  // Modo "movements vinculados a este item" (usado pela aba do item-form): não é paginado,
  // devolve todos os movevents cujo seletor (ITEM_ID exato/range, ou ITEM_RANGE) cobre o id
  // pedido. Não dá para expressar a checagem de range em JSON via WHERE do Prisma, então
  // trazemos os candidatos plausíveis e filtramos com precisão em JS.
  if (itemIdParam != null) {
    const targetItemId = Number(itemIdParam);
    const candidates = await prisma.movement.findMany({
      where: {
        OR: [
          { itemId: targetItemId },
          { selectorType: "ITEM_RANGE" },
          { AND: [{ selectorType: "ITEM_ID" }, { itemIdRangeEnd: { not: null } }] },
        ],
      },
      include: MOVEMENT_INCLUDE,
      orderBy: { id: "asc" },
    });

    const matches = candidates
      .map((row) => ({ id: row.id, input: movementRowToFormInput(row) }))
      .filter(({ input }) => movementMatchesItemId(input, targetItemId));

    return NextResponse.json({ data: matches });
  }

  const { page, pageSize, search } = parsePaginationParams(url);
  const eventType = url.searchParams.get("eventType");
  const selectorType = url.searchParams.get("selectorType");

  const where: Prisma.MovementWhereInput = {
    ...(search
      ? {
          OR: [
            { actionValue: { contains: search } },
            { slot: { contains: search } },
          ],
        }
      : {}),
    ...(eventType ? { eventType } : {}),
    ...(selectorType ? { selectorType } : {}),
  };

  const [movements, total] = await Promise.all([
    prisma.movement.findMany({
      where,
      include: MOVEMENT_INCLUDE,
      orderBy: { id: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.movement.count({ where }),
  ]);

  return NextResponse.json(
    buildPaginatedResult(
      movements.map((movement) => ({ ...movementRowToFormInput(movement), id: movement.id })),
      total,
      page,
      pageSize
    )
  );
});

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const body = await request.json();
  const parsed = movementSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 422 }
    );
  }

  const movement = await prisma.movement.create({
    data: {
      ...movementFormToRow(parsed.data),
      vocations: { create: parsed.data.vocations.map((v) => ({ vocationId: v.vocationId })) },
    },
    include: MOVEMENT_INCLUDE,
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "create",
    entity: "movement",
    entityId: movement.id,
    metadata: { eventType: movement.eventType },
  });

  return NextResponse.json({ movement: { ...movementRowToFormInput(movement), id: movement.id } }, { status: 201 });
});
