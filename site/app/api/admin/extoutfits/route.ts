import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { buildPaginatedResult, parseIdsParam, parsePaginationParams } from "@/lib/pagination";
import { extOutfitSchema } from "@/lib/validations/admin/extoutfit";
import {
  extOutfitImageExtensions,
  extOutfitInclude,
  extOutfitInputToPrismaData,
  extOutfitToRow,
} from "@/lib/extoutfit-mapper";
import { withAudit } from "@/lib/api-audit-wrapper";

export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const url = new URL(request.url);

  const ids = parseIdsParam(url);
  if (ids) {
    const byId = await prisma.extOutfit.findMany({ where: { id: { in: ids } }, include: extOutfitInclude });
    const extensions = await extOutfitImageExtensions(prisma, byId.map((entry) => entry.id));
    const rows = byId.map((entry) => extOutfitToRow(entry, extensions.get(entry.id) ?? null));
    return NextResponse.json(buildPaginatedResult(rows, rows.length, 1, rows.length || 1));
  }

  const { page, pageSize, search } = parsePaginationParams(url);
  const kind = url.searchParams.get("kind");
  const numericSearch = Number.isInteger(Number(search)) && search !== "" ? Number(search) : null;

  const where: Prisma.ExtOutfitWhereInput = {
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { shaderName: { contains: search } },
            { image: { contains: search } },
            ...(numericSearch !== null
              ? [{ xmlId: numericSearch }, { looktype: { looktypeNumber: numericSearch } }]
              : []),
          ],
        }
      : {}),
    ...(kind ? { kind } : {}),
  };

  const [entries, total] = await Promise.all([
    prisma.extOutfit.findMany({
      where,
      // Mesma ordem do arquivo: kind na ordem das seções é aplicada no export; aqui basta agrupar.
      orderBy: [{ kind: "asc" }, { xmlId: "asc" }],
      include: extOutfitInclude,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.extOutfit.count({ where }),
  ]);

  const extensions = await extOutfitImageExtensions(prisma, entries.map((entry) => entry.id));
  const rows = entries.map((entry) => extOutfitToRow(entry, extensions.get(entry.id) ?? null));
  return NextResponse.json(buildPaginatedResult(rows, total, page, pageSize));
});

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const parsed = extOutfitSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 422 });
  }

  const existing = await prisma.extOutfit.findUnique({
    where: { kind_xmlId: { kind: parsed.data.kind, xmlId: parsed.data.xmlId } },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Já existe <${parsed.data.kind}> com o id ${parsed.data.xmlId}.` },
      { status: 409 },
    );
  }

  const entry = await prisma.extOutfit.create({ data: extOutfitInputToPrismaData(parsed.data) });

  await logAudit({
    accountId: Number(session.user.id),
    action: "create",
    entity: "extoutfit",
    entityId: entry.id,
    metadata: { kind: entry.kind, xmlId: entry.xmlId, name: entry.name },
  });

  return NextResponse.json({ extOutfit: entry }, { status: 201 });
});
