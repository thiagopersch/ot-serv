import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { withAudit } from "@/lib/api-audit-wrapper";
import { MAX_DAT_BYTES, MAX_SPR_BYTES } from "@/lib/tibia-client/limits";
import { parseOtfi, DEFAULT_TIBIA_CLIENT_FORMAT } from "@/lib/tibia-client/otfi-parser";
import { createJob, getActiveJob, hasActiveJob, type ImportJobCategory } from "@/lib/tibia-client/import-job-store";
import { runImportJob } from "@/lib/tibia-client/import-runner";

const MAX_OTFI_BYTES = 1 * 1024 * 1024;
const ALL_CATEGORIES: ImportJobCategory[] = ["item", "outfit", "effect", "missile"];

function parseCategories(raw: FormDataEntryValue | null): ImportJobCategory[] {
  if (typeof raw !== "string" || !raw) return ALL_CATEGORIES;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return ALL_CATEGORIES;
    const valid = parsed.filter((value): value is ImportJobCategory => (ALL_CATEGORIES as string[]).includes(value));
    return valid.length > 0 ? valid : ALL_CATEGORIES;
  } catch {
    return ALL_CATEGORIES;
  }
}

/** Consultado pela UI ao montar a página (sem precisar de um `jobId` salvo localmente) — assim
 * qualquer admin que abra `/admin/looktypes` vê um import de cliente já em andamento, iniciado
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
    return NextResponse.json({ error: "Já existe um import de cliente em andamento." }, { status: 409 });
  }

  const formData = await request.formData();
  const datFile = formData.get("datFile");
  const sprFile = formData.get("sprFile");
  const otfiFile = formData.get("otfiFile");
  const categories = parseCategories(formData.get("categories"));
  const overwriteExisting = formData.get("overwriteExisting") === "true";

  if (!(datFile instanceof File) || !(sprFile instanceof File)) {
    return NextResponse.json({ error: "Selecione o Tibia.dat e o Tibia.spr." }, { status: 422 });
  }
  if (datFile.size > MAX_DAT_BYTES) {
    return NextResponse.json({ error: `Tibia.dat maior que o limite (${MAX_DAT_BYTES} bytes).` }, { status: 413 });
  }
  if (sprFile.size > MAX_SPR_BYTES) {
    return NextResponse.json({ error: `Tibia.spr maior que o limite (${MAX_SPR_BYTES} bytes).` }, { status: 413 });
  }
  if (otfiFile instanceof File && otfiFile.size > MAX_OTFI_BYTES) {
    return NextResponse.json({ error: "Tibia.otfi maior que o esperado — arquivo inválido?" }, { status: 413 });
  }

  const datBuffer = Buffer.from(await datFile.arrayBuffer());
  const sprBuffer = Buffer.from(await sprFile.arrayBuffer());
  if (datBuffer.length === 0 || sprBuffer.length === 0) {
    return NextResponse.json({ error: "Arquivo vazio." }, { status: 422 });
  }

  const format =
    otfiFile instanceof File
      ? parseOtfi(await otfiFile.text())
      : DEFAULT_TIBIA_CLIENT_FORMAT;

  const jobId = crypto.randomUUID();
  createJob(jobId, accountId);

  // Fire-and-forget: o processamento roda fora do ciclo de vida desta requisição HTTP (evita
  // timeout de proxy/browser num import que pode levar minutos) — progresso via polling em
  // `GET .../[jobId]`, resultado final sempre persistido em auditoria mesmo se ninguém acompanhar.
  void runImportJob(jobId, datBuffer, sprBuffer, accountId, { format, categories, overwriteExisting });

  await logAudit({
    accountId,
    action: "import_client_start",
    entity: "looktype",
    metadata: {
      jobId,
      datFileName: datFile.name,
      sprFileName: sprFile.name,
      datSizeBytes: datFile.size,
      sprSizeBytes: sprFile.size,
      categories,
      format,
      overwriteExisting,
    },
  });

  return NextResponse.json({ jobId }, { status: 202 });
});
