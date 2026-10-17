import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import {
  autolootItemBulkSchema,
  autolootItemBulkUpdateSchema,
} from "@/lib/validations/admin/autoloot-item";
import { withAudit } from "@/lib/api-audit-wrapper";

const AUDIT_CHUNK_SIZE = 500;

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo JSON inválido." }, { status: 400 });
  }

  const parsed = autolootItemBulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const { items, published } = parsed.data;

  try {
    const existing = await prisma.autolootItem.findMany({
      where: { itemId: { in: items.map((item) => item.itemId) } },
      select: { itemId: true },
    });
    const existingIds = new Set(existing.map((row) => row.itemId));

    const toCreate = items.filter((item) => !existingIds.has(item.itemId));
    const skipped = items.filter((item) => existingIds.has(item.itemId)).map((item) => item.itemId);

    // Nome sempre do cadastro de itens — o cliente só conhece os nomes da página atual da
    // tabela, então itens marcados em outras páginas chegavam com o id no lugar do nome.
    const catalogItems = await prisma.item.findMany({
      where: { id: { in: toCreate.map((item) => item.itemId) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(catalogItems.map((item) => [item.id, item.name]));

    const created = await prisma.$transaction(
      toCreate.map((item) =>
        prisma.autolootItem.create({
          data: {
            itemId: item.itemId,
            name: nameById.get(item.itemId) || item.name || String(item.itemId),
            published,
          },
        }),
      ),
    );

    // Auditoria em lote (chunks) em vez de um create por item — com centenas de itens a
    // sequência de awaits individuais era lenta e desnecessariamente instável.
    for (let i = 0; i < created.length; i += AUDIT_CHUNK_SIZE) {
      const chunk = created.slice(i, i + AUDIT_CHUNK_SIZE);
      await prisma.auditLog.createMany({
        data: chunk.map((autolootItem) => ({
          accountId: Number(session.user.id),
          action: "create",
          entity: "autoloot_item",
          entityId: String(autolootItem.id),
          metadata: {
            itemId: autolootItem.itemId,
            name: autolootItem.name,
            published: autolootItem.published,
          },
        })),
      });
    }

    return NextResponse.json({ created, skipped }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido ao salvar.";
    return NextResponse.json({ error: `Não foi possível salvar: ${message}` }, { status: 500 });
  }
});

/** Edição em massa (Tipo/Publicado) dos itens selecionados na listagem. */
export const PATCH = withAudit(async function PATCH(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo JSON inválido." }, { status: 400 });
  }

  const parsed = autolootItemBulkUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const { ids, category, published } = parsed.data;
  const data = {
    ...(category !== undefined ? { category } : {}),
    ...(published !== undefined ? { published } : {}),
  };

  const result = await prisma.autolootItem.updateMany({ where: { id: { in: ids } }, data });

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "autoloot_item",
    // entity_id é VARCHAR(100) — a lista completa de ids vai só no metadata.
    entityId: ids.length === 1 ? ids[0] : null,
    metadata: { bulk: true, ids, ...data },
  });

  return NextResponse.json({ updatedCount: result.count });
});
