/**
 * Job de import em lote de monstros (XML) — disparado fire-and-forget por
 * `POST /api/admin/monsters/import` (ver `import-job-store.ts` para o progresso consultável por
 * polling e `app/api/admin/monsters/import/[jobId]` para quem lê). Por arquivo: parse do XML,
 * auto-vínculo da looktype de outfit pelo `type="xx"` do `<look>` (via `Looktype.looktypeNumber`)
 * e criação/atualização, gravando auditoria individual — mesma lógica que antes rodava inline no
 * handler da rota, agora com progresso acumulado no job e resultado final também em auditoria.
 */
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { parseMonsterXml } from "@/lib/monster-xml-parser";
import { monsterFormToRow } from "@/lib/monster-mapper";
import { findOutfitLooktypeByNumber } from "@/lib/looktype-lookup";
import { getJob, incrementJob, pushJobError, updateJob } from "@/lib/monster/import-job-store";

export type MonsterImportFile = { name: string; xml: string };

export type MonsterImportOptions = {
  universe: { id: number; name: string };
  subcategory: string;
  updateExisting: boolean;
};

/** Processa um único arquivo `<monster>` e registra em auditoria. `false` = arquivo ignorado
 * (parse falho ou duplicado sem `updateExisting`); o motivo é empurrado para `job.errors`. */
async function importMonsterXml(
  jobId: string,
  accountId: number,
  fileName: string,
  xml: string,
  options: MonsterImportOptions
): Promise<boolean> {
  const { monster, lookTypeNumber, error } = parseMonsterXml(xml, {
    category: options.universe.name,
    subcategory: options.subcategory,
    universeId: options.universe.id,
  });

  if (!monster) {
    pushJobError(jobId, `${fileName}: ${error ?? "arquivo inválido"}`);
    return false;
  }

  const existing = await prisma.monster.findUnique({
    where: { name: monster.name },
  });

  if (existing && !options.updateExisting) {
    pushJobError(jobId, `${fileName}: já existe um monstro chamado "${monster.name}"`);
    return false;
  }

  // Auto-vínculo: o `type="xx"` do `<look>` do XML importado é resolvido para o registro de
  // looktype de outfit cadastrado (`Looktype.looktypeNumber`), dispensando o vínculo manual.
  const looktype =
    lookTypeNumber != null ? await findOutfitLooktypeByNumber(prisma, lookTypeNumber) : null;

  const row = monsterFormToRow(monster);
  let data: Parameters<typeof prisma.monster.create>[0]["data"];

  if (looktype) {
    data = {
      ...row,
      lookTypeId: looktype.id,
      lookType: looktype.looktypeNumber ?? 0,
    };
  } else if (existing) {
    // Preserva o vínculo de looktype que o admin já havia definido manualmente — o import
    // não deve desvincular quando o XML não tem `type`/match.
    data = {
      ...row,
      lookType: existing.lookType,
      lookTypeId: existing.lookTypeId,
    };
  } else {
    data = row;
  }

  const saved = existing
    ? await prisma.monster.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.monster.create({ data });

  await logAudit({
    accountId,
    action: "import",
    entity: "monster",
    entityId: saved.id,
    metadata: {
      name: saved.name,
      updated: Boolean(existing),
      jobId,
      lookTypeNumber,
      autoLinkedLooktypeId: looktype?.id ?? null,
    },
  });

  return true;
}

export async function runMonsterImportJob(
  jobId: string,
  accountId: number,
  files: MonsterImportFile[],
  options: MonsterImportOptions
): Promise<void> {
  try {
    updateJob(jobId, { total: files.length });

    for (const file of files) {
      const job = getJob(jobId);
      if (!job) return;

      const imported = await importMonsterXml(jobId, accountId, file.name, file.xml, options);
      incrementJob(jobId, { processed: 1, imported: imported ? 1 : 0, skipped: imported ? 0 : 1 });
    }

    const finalJob = getJob(jobId);
    updateJob(jobId, { status: "done" });

    await logAudit({
      accountId,
      action: "import_summary",
      entity: "monster",
      metadata: {
        jobId,
        status: "done",
        total: finalJob?.total ?? files.length,
        imported: finalJob?.imported ?? 0,
        skipped: finalJob?.skipped ?? 0,
        errors: finalJob?.errors ?? [],
      },
    }).catch((error) => console.error("Falha ao registrar auditoria de import_summary (monstros)", error));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido ao importar os monstros.";
    updateJob(jobId, { status: "error", errorMessage: message });

    await logAudit({
      accountId,
      action: "import_error",
      entity: "monster",
      metadata: { jobId, reason: message },
    }).catch((auditError) => console.error("Falha ao registrar auditoria de import_error (monstros)", auditError));
  }
}