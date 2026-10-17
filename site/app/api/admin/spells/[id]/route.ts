import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { spellFormSchema } from "@/lib/validations/admin/spell";
import { spellFormToScalarData, spellToFormInput } from "@/lib/spell-mapper";
import { hasDuplicateName } from "@/lib/unique-name";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const GET = withAudit(async function GET(_request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const spell = await prisma.spell.findUnique({
    where: { id: Number(id) },
    include: { vocations: true },
  });

  if (!spell) {
    return NextResponse.json({ error: "Spell não encontrada." }, { status: 404 });
  }

  return NextResponse.json({ spell: spellToFormInput(spell) });
});

export const PATCH = withAudit(async function PATCH(request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const body = await request.json();
  const parsed = spellFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  // Unicidade escopada por `kind` — ver comentário equivalente em app/api/admin/spells/route.ts.
  const existingNames = await prisma.spell.findMany({
    where: { kind: parsed.data.kind },
    select: { id: true, name: true },
  });
  if (hasDuplicateName(existingNames, parsed.data.name, Number(id))) {
    return NextResponse.json({ error: "Já existe uma spell desse kind com esse nome." }, { status: 409 });
  }

  const spell = await prisma.spell.update({
    where: { id: Number(id) },
    data: {
      ...spellFormToScalarData(parsed.data),
      vocations: {
        deleteMany: {},
        create: parsed.data.vocations.map((vocation) => ({
          vocationId: vocation.vocationId,
          showInDescription: vocation.showInDescription,
        })),
      },
    },
    include: { vocations: true },
  });

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "spell",
    entityId: spell.id,
    metadata: { name: spell.name, kind: spell.kind },
  });

  return NextResponse.json({ spell: spellToFormInput(spell) });
});

export const DELETE = withAudit(async function DELETE(_request: Request, { params }: Params) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  await prisma.spell.delete({ where: { id: Number(id) } });

  await logAudit({
    accountId: Number(session.user.id),
    action: "delete",
    entity: "spell",
    entityId: id,
  });

  return NextResponse.json({ success: true });
});
