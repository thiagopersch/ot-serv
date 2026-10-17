/**
 * Job de import de um cliente Tibia (`.dat`+`.spr`) inteiro para `Looktype` — disparado
 * fire-and-forget por `POST /api/admin/looktypes/import-client` (ver `import-job-store.ts` para o
 * progresso consultável por polling). Reaproveita a mesma pipeline de renderização do upload
 * manual de `.obd` (`renderLooktypeFrames`/`lib/obd/obd-render.ts`) via `toObdThingData`
 * (`dat-to-obd-adapter.ts`) — só a origem dos dados (`.dat`/`.spr` cru em vez de `.obd`) muda.
 *
 * Deduplicação: sempre que um thing já tem um looktype existente equivalente (mesmo nome padrão,
 * mesmo `looktypeNumber`, ou o id embutido no nome — ver `findExistingCandidates`), o import nunca
 * cria uma segunda linha. O comportamento depende da flag `overwriteExisting` (enviada pela UI):
 *
 * - `false` (padrão, estilo "substituir" do import de lua-scripts): existentes são PRESERVADOS —
 *   o thing é pulado (nada é atualizado/apagado/criado) e o registro atual fica intocado.
 * - `true`: o cadastro existente é SObrescrito no lugar — se nenhum candidato estiver vinculado a
 *   algo (item/monstro/npc/vocação/spell — `lib/looktype-usage.ts`), o candidato canônico é
 *   atualizado no lugar (nome padronizado + sprite/frames corrigidos, mesmo `id`) preservando
 *   referências; se exatamente 1 estiver vinculado esse é o escolhido. Múltiplos candidatos
 *   vinculados continuam dando erro (resolução manual), como antes.
 */
import { promises as fs } from "node:fs";

import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { findLinkedLooktypeIds } from "@/lib/looktype-usage";
import { looktypeFrameDirPath, looktypeFrameStoragePath } from "@/lib/looktype-storage";
import { outfitFrameFieldsFrom, writeOutfitDirectionalFrames } from "@/lib/outfit-frame-storage";
import { renderLooktypeFrames, renderOutfitDirectionalFrames } from "@/lib/obd/obd-render";
import { DEFAULT_LOOKTYPE_FRAME_SPEED_MS } from "@/lib/validations/admin/looktype";
import {
  DatParseError,
  parseDat,
  type TibiaDatCategory,
  type TibiaDatParseResult,
  type TibiaDatThing,
} from "@/lib/tibia-client/dat-parser";
import { SprParseError, TibiaSprReader } from "@/lib/tibia-client/spr-parser";
import { toObdThingData } from "@/lib/tibia-client/dat-to-obd-adapter";
import type { TibiaClientFormat } from "@/lib/tibia-client/otfi-parser";
import { updateJob, incrementCount, getJob, type ImportJobCategory } from "@/lib/tibia-client/import-job-store";

const ALL_CATEGORIES: ImportJobCategory[] = ["item", "outfit", "effect", "missile"];

/** Checa a flag de cancelamento a cada N things (não a cada 1) — ler o `Map` do job store a cada
 * iteração seria desnecessário; a granularidade de alguns milissegundos de atraso pra reagir ao
 * cancelamento é aceitável dado o volume (dezenas de milhares de things). */
const CANCEL_CHECK_INTERVAL = 50;
/** Tamanho de lote do `auditLog.createMany`/`IN (...)` — mesmo valor usado como referência de
 * "lote grande" em `import-log/route.ts`/`route.ts` do endpoint manual. */
const AUDIT_CHUNK_SIZE = 500;

type SkipOrErrorEntry = {
  fileName: string;
  name: string;
  looktypeNumber: number | null;
  category: string;
  reason: string;
};

type ExistingRow = { id: number; name: string; looktypeNumber: number | null };

function expectedName(category: TibiaDatCategory, id: number): string {
  return category === "item" ? `item_${id}` : `${category}_${id}`;
}

function thingsByCategory(dat: TibiaDatParseResult, category: ImportJobCategory): TibiaDatThing[] {
  switch (category) {
    case "item":
      return dat.items;
    case "outfit":
      return dat.outfits;
    case "effect":
      return dat.effects;
    case "missile":
      return dat.missiles;
  }
}

async function flushAuditChunk(accountId: number, action: "import_skip" | "import_error", jobId: string, entries: SkipOrErrorEntry[]) {
  if (entries.length === 0) return;
  for (let i = 0; i < entries.length; i += AUDIT_CHUNK_SIZE) {
    const chunk = entries.slice(i, i + AUDIT_CHUNK_SIZE);
    await prisma.auditLog
      .createMany({
        data: chunk.map((entry) => ({
          accountId,
          action,
          entity: "looktype",
          metadata: { ...entry, jobId },
        })),
      })
      .catch((error) => console.error(`Falha ao registrar auditoria em lote (${action})`, error));
  }
}

/** Extrai todos os números "inteiros isolados" de um nome (`/\d+/g` já respeita os limites certos
 * — "6836" nunca é confundido com "836" ou "68360", já que o regex captura a sequência de dígitos
 * inteira). Usado pra achar looktypes com o id do thing embutido no nome mesmo quando o nome não
 * segue exatamente o padrão `categoria_id` (ex.: sobrou de um import anterior com outro formato). */
function extractEmbeddedNumbers(name: string): number[] {
  const matches = name.match(/\d+/g);
  return matches ? matches.map(Number) : [];
}

type ExistingIndex = {
  byName: Map<string, ExistingRow>;
  byNumber: Map<number, ExistingRow>;
  byEmbeddedId: Map<number, ExistingRow[]>;
};

function buildExistingIndex(rows: ExistingRow[]): ExistingIndex {
  const byName = new Map<string, ExistingRow>();
  const byNumber = new Map<number, ExistingRow>();
  const byEmbeddedId = new Map<number, ExistingRow[]>();

  for (const row of rows) {
    byName.set(row.name, row);
    if (row.looktypeNumber !== null) byNumber.set(row.looktypeNumber, row);
    for (const embedded of extractEmbeddedNumbers(row.name)) {
      const list = byEmbeddedId.get(embedded);
      if (list) list.push(row);
      else byEmbeddedId.set(embedded, [row]);
    }
  }

  return { byName, byNumber, byEmbeddedId };
}

/** Candidatos "é o mesmo thing de antes, só que com nome/número desatualizado": nome padrão exato,
 * `looktypeNumber` igual ao id (categorias não-item), ou o id aparecendo como número isolado em
 * qualquer lugar do nome (cobre nomes que não seguem o padrão `categoria_id` à risca). */
function findExistingCandidates(
  index: ExistingIndex,
  category: TibiaDatCategory,
  id: number,
  standardName: string
): ExistingRow[] {
  const candidates = new Map<number, ExistingRow>();

  const byName = index.byName.get(standardName);
  if (byName) candidates.set(byName.id, byName);

  if (category !== "item") {
    const byNumber = index.byNumber.get(id);
    if (byNumber) candidates.set(byNumber.id, byNumber);
  }

  for (const row of index.byEmbeddedId.get(id) ?? []) candidates.set(row.id, row);

  return [...candidates.values()];
}

export async function runImportJob(
  jobId: string,
  datBuffer: Buffer,
  sprBuffer: Buffer,
  accountId: number,
  options: { format: TibiaClientFormat; categories: ImportJobCategory[]; overwriteExisting: boolean }
): Promise<void> {
  try {
    const dat = parseDat(datBuffer, options.format);
    const spr = TibiaSprReader.open(sprBuffer, options.format);
    const categoriesToRun = ALL_CATEGORIES.filter((category) => options.categories.includes(category));

    updateJob(jobId, {
      warnings: dat.warnings,
      perCategory: {
        item: { total: categoriesToRun.includes("item") ? dat.items.length : 0, created: 0, updated: 0, skipped: 0, errored: 0 },
        outfit: { total: categoriesToRun.includes("outfit") ? dat.outfits.length : 0, created: 0, updated: 0, skipped: 0, errored: 0 },
        effect: { total: categoriesToRun.includes("effect") ? dat.effects.length : 0, created: 0, updated: 0, skipped: 0, errored: 0 },
        missile: { total: categoriesToRun.includes("missile") ? dat.missiles.length : 0, created: 0, updated: 0, skipped: 0, errored: 0 },
      },
    });

    for (const category of categoriesToRun) {
      const job = getJob(jobId);
      if (!job || job.cancelRequested) break;

      updateJob(jobId, { currentCategory: category });
      await processCategory(jobId, accountId, category, thingsByCategory(dat, category), spr, options.overwriteExisting);
    }

    const finalJob = getJob(jobId);
    const cancelled = finalJob?.cancelRequested ?? false;
    updateJob(jobId, { status: cancelled ? "cancelled" : "done", currentCategory: null });

    const totals = finalJob?.perCategory;
    await logAudit({
      accountId,
      action: "import_summary",
      entity: "looktype",
      metadata: {
        jobId,
        status: cancelled ? "cancelled" : "done",
        categories: categoriesToRun,
        overwriteExisting: options.overwriteExisting,
        perCategory: totals,
        warnings: dat.warnings,
      },
    }).catch((error) => console.error("Falha ao registrar auditoria de import_summary (cliente)", error));
  } catch (error) {
    const message =
      error instanceof DatParseError || error instanceof SprParseError || error instanceof Error
        ? error.message
        : "Erro desconhecido ao interpretar os arquivos do cliente.";

    updateJob(jobId, { status: "error", errorMessage: message, currentCategory: null });

    await logAudit({
      accountId,
      action: "import_client_error",
      entity: "looktype",
      metadata: {
        jobId,
        reason: message,
        context: error instanceof DatParseError ? error.context : null,
      },
    }).catch((auditError) => console.error("Falha ao registrar auditoria de import_client_error", auditError));
  }
}

async function fetchExistingRows(category: ImportJobCategory): Promise<ExistingRow[]> {
  return prisma.looktype.findMany({
    where: { category },
    select: { id: true, name: true, looktypeNumber: true },
  });
}

async function removeLooktype(id: number): Promise<void> {
  await prisma.looktype.delete({ where: { id } }).catch(() => null);
  await fs.rm(looktypeFrameDirPath(id), { recursive: true, force: true }).catch(() => null);
}

async function writeFrames(looktypeId: number, frames: { png: Buffer; durationMs: number }[], errorEntries: SkipOrErrorEntry[], errorCtx: SkipOrErrorEntry) {
  const frameDir = looktypeFrameDirPath(looktypeId);
  await fs.mkdir(frameDir, { recursive: true });
  await Promise.all(
    frames.map((frame, index) =>
      fs.writeFile(looktypeFrameStoragePath(looktypeId, index), frame.png).catch((writeError) => {
        errorEntries.push({
          ...errorCtx,
          reason: `Falha ao gravar frame ${index}: ${writeError instanceof Error ? writeError.message : String(writeError)}`,
        });
      })
    )
  );
}

async function processCategory(
  jobId: string,
  accountId: number,
  category: ImportJobCategory,
  things: TibiaDatThing[],
  spr: TibiaSprReader,
  overwriteExisting: boolean
): Promise<void> {
  if (things.length === 0) return;

  const existingRows = await fetchExistingRows(category);
  const index = buildExistingIndex(existingRows);

  // Descobre de antemão TODOS os candidatos de TODA a categoria pra checar vínculo em lote (5
  // queries por chunk, não 5 por thing) — crítico pra um reimport idempotente de dezenas de
  // milhares de things não abrir centenas de milhares de queries sequenciais.
  const candidatesByThingId = new Map<number, ExistingRow[]>();
  const allCandidateIds = new Set<number>();
  for (const thing of things) {
    const candidates = findExistingCandidates(index, category, thing.id, expectedName(category, thing.id));
    if (candidates.length > 0) {
      candidatesByThingId.set(thing.id, candidates);
      for (const candidate of candidates) allCandidateIds.add(candidate.id);
    }
  }
  const linkedIds = await findLinkedLooktypeIds([...allCandidateIds]);

  const skipEntries: SkipOrErrorEntry[] = [];
  const errorEntries: SkipOrErrorEntry[] = [];

  for (let i = 0; i < things.length; i++) {
    if (i % CANCEL_CHECK_INTERVAL === 0) {
      const job = getJob(jobId);
      if (!job || job.cancelRequested) break;
    }

    const thing = things[i];
    const name = expectedName(category, thing.id);
    const looktypeNumber = category === "item" ? null : thing.id;
    const errorCtx: SkipOrErrorEntry = { fileName: `${category}#${thing.id}`, name, looktypeNumber, category, reason: "" };

    const candidates = candidatesByThingId.get(thing.id) ?? [];

    // Sem a flag de sobrescrita, o cadastro existente é preservado: coisa que já tem um looktype
    // equivalente (mesmo nome/número/id embutido) é pulada — nada é atualizado, apagado ou recriado.
    if (!overwriteExisting && candidates.length > 0) {
      skipEntries.push({
        ...errorCtx,
        reason: "Looktype existente preservado — import sem sobrescrita marcada.",
      });
      incrementCount(jobId, category, "skipped");
      continue;
    }

    const linkedCandidates = candidates.filter((candidate) => linkedIds.has(candidate.id));

    if (linkedCandidates.length > 1) {
      errorEntries.push({
        ...errorCtx,
        reason: `Múltiplos looktypes existentes vinculados a algo batem com este thing (ids ${linkedCandidates.map((c) => c.id).join(", ")}) — resolução automática abortada, ajuste manualmente.`,
      });
      incrementCount(jobId, category, "errored");
      continue;
    }

    try {
      const obdThing = toObdThingData(thing, spr);
      const frames = renderLooktypeFrames(obdThing, DEFAULT_LOOKTYPE_FRAME_SPEED_MS[category]);
      // Direção/máscara de cor só fazem sentido pra outfit — ver `lib/outfit-frame-storage.ts`
      // (mesma lógica usada pelo upload manual de `.obd` e pela edição de looktype existente).
      const outfitDirectional =
        category === "outfit" ? renderOutfitDirectionalFrames(obdThing, DEFAULT_LOOKTYPE_FRAME_SPEED_MS[category]) : null;
      const outfitFrameFields = outfitDirectional
        ? outfitFrameFieldsFrom(outfitDirectional)
        : { directions: 1, hasColorMask: false, addonSlots: 0 };

      let looktypeId: number;
      if (candidates.length > 0) {
        // Sobrescreve NO LUGAR preservando o id: prioriza o candidato vinculado (não quebra quem
        // já referencia), senão o de nome padrão, senão o de menor id. Remove só os candidatos não
        // vinculados — apagar um vinculado quebraria a referência que o usa.
        const standardNameRow = index.byName.get(name);
        const canonical =
          linkedCandidates[0] ??
          standardNameRow ??
          candidates.reduce((best, candidate) => (candidate.id < best.id ? candidate : best), candidates[0]);
        const candidatesToRemove = candidates.filter(
          (candidate) => candidate.id !== canonical.id && !linkedIds.has(candidate.id),
        );

        await Promise.all(candidatesToRemove.map((candidate) => removeLooktype(candidate.id)));
        await fs.rm(looktypeFrameDirPath(canonical.id), { recursive: true, force: true }).catch(() => null);
        const updated = await prisma.looktype.update({
          where: { id: canonical.id },
          data: {
            name,
            width: thing.width,
            height: thing.height,
            frameCount: frames.length,
            frameDurationsMs: frames.map((frame) => frame.durationMs),
            directions: outfitFrameFields.directions,
            hasColorMask: outfitFrameFields.hasColorMask,
            addonSlots: outfitFrameFields.addonSlots,
          },
        });
        looktypeId = updated.id;
        incrementCount(jobId, category, "updated");
      } else {
        const created = await prisma.looktype.create({
          data: {
            name,
            category,
            looktypeNumber,
            width: thing.width,
            height: thing.height,
            frameCount: frames.length,
            frameDurationsMs: frames.map((frame) => frame.durationMs),
            directions: outfitFrameFields.directions,
            hasColorMask: outfitFrameFields.hasColorMask,
            addonSlots: outfitFrameFields.addonSlots,
          },
        });
        looktypeId = created.id;
        incrementCount(jobId, category, "created");
      }

      await writeFrames(looktypeId, frames, errorEntries, errorCtx);
      if (outfitDirectional) await writeOutfitDirectionalFrames(looktypeId, outfitDirectional);
    } catch (error) {
      // Corrida entre o pré-check em lote e a criação (outro processo/aba criou o mesmo
      // nome/número nesse meio-tempo).
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        skipEntries.push({ ...errorCtx, reason: "Corrida de criação — já existe uma sprite com o mesmo nome/número (detectado ao salvar)." });
        incrementCount(jobId, category, "skipped");
      } else {
        errorEntries.push({ ...errorCtx, reason: error instanceof Error ? error.message : "Erro desconhecido ao renderizar/salvar." });
        incrementCount(jobId, category, "errored");
      }
    }

    if (skipEntries.length >= AUDIT_CHUNK_SIZE) await flushAuditChunk(accountId, "import_skip", jobId, skipEntries.splice(0));
    if (errorEntries.length >= AUDIT_CHUNK_SIZE) await flushAuditChunk(accountId, "import_error", jobId, errorEntries.splice(0));
  }

  await flushAuditChunk(accountId, "import_skip", jobId, skipEntries);
  await flushAuditChunk(accountId, "import_error", jobId, errorEntries);
}
