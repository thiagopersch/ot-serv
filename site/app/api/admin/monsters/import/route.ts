import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { createJob, getActiveJob, hasActiveJob } from "@/lib/monster/import-job-store";
import { runMonsterImportJob } from "@/lib/monster/import-runner";
import { withAudit } from "@/lib/api-audit-wrapper";

/** Consultado pela UI ao montar a página (sem precisar de um `jobId` salvo localmente) — assim
 * qualquer admin que abra `/admin/monsters` vê um import de monstros já em andamento, iniciado
 * por outra aba/sessão. */
export const GET = withAudit(async function GET() {
  const { response } = await requireAdminSession();
  if (response) return response;

  return NextResponse.json({ job: getActiveJob() });
});

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const accountId = Number(session.user.id);

  if (hasActiveJob()) {
    return NextResponse.json(
      { error: "Já existe um import de monstros em andamento. Aguarde ou feche o outro diálogo." },
      { status: 409 },
    );
  }

  const formData = await request.formData();
  const legacyFile = formData.get("file");
  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File);
  if (legacyFile instanceof File) files.push(legacyFile);

  const updateExisting = formData.get("replaceExisting") === "true";
  const universeIdRaw = formData.get("universeId");
  const subcategory = formData.get("subcategory");

  if (files.length === 0) {
    return NextResponse.json(
      { error: "Nenhum arquivo enviado." },
      { status: 422 },
    );
  }

  const universeId = typeof universeIdRaw === "string" ? Number(universeIdRaw) : NaN;
  if (!Number.isInteger(universeId)) {
    return NextResponse.json(
      { error: "Selecione o universo para importar." },
      { status: 422 },
    );
  }

  if (typeof subcategory !== "string" || !subcategory.trim()) {
    return NextResponse.json(
      { error: "Informe a subcategoria/subpasta para importar." },
      { status: 422 },
    );
  }

  const universe = await prisma.universe.findUnique({ where: { id: universeId } });
  if (!universe) {
    return NextResponse.json(
      { error: "Universo não encontrado." },
      { status: 422 },
    );
  }

  const filesToImport = await Promise.all(
    files.map(async (file) => ({ name: file.name, xml: await file.text() })),
  );

  const jobId = crypto.randomUUID();
  createJob(jobId, accountId);

  // Fire-and-forget: o processamento roda fora do ciclo de vida desta requisição HTTP — progresso
  // via polling em `GET .../[jobId]`, resultado final sempre persistido em auditoria mesmo se
  // ninguém acompanhar.
  void runMonsterImportJob(jobId, accountId, filesToImport, {
    universe: { id: universe.id, name: universe.name },
    subcategory,
    updateExisting,
  });

  await logAudit({
    accountId,
    action: "import_start",
    entity: "monster",
    metadata: {
      jobId,
      fileCount: filesToImport.length,
      universeId: universe.id,
      subcategory,
      updateExisting,
    },
  });

  return NextResponse.json({ jobId }, { status: 202 });
});