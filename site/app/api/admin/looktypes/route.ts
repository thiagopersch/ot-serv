import { promises as fs } from "node:fs";

import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { buildPaginatedResult, parseIdsParam, parsePaginationParams } from "@/lib/pagination";
import { LOOKTYPE_CATEGORIES } from "@/lib/validations/admin/looktype";
import { MAX_IMAGE_BYTES, detectImageExtension } from "@/lib/entity-image";
import { looktypeFrameDirPath, looktypeFrameStoragePath } from "@/lib/looktype-storage";
import { outfitFrameFieldsFrom, writeOutfitDirectionalFrames, type OutfitFrameFields } from "@/lib/outfit-frame-storage";
import { findLinkedLooktypeIds } from "@/lib/looktype-usage";
import { ObdParseError, parseObd } from "@/lib/obd/obd-parser";
import { renderLooktypeFrames, renderOutfitDirectionalFrames, type RenderedOutfitResult } from "@/lib/obd/obd-render";
import { withAudit } from "@/lib/api-audit-wrapper";

const MAX_OBD_BYTES = 8 * 1024 * 1024;

// Ordem de exibição das categorias na listagem do admin (item -> outfit -> effect -> missile,
// que no jogo/no Object Builder é chamado de "distance effect") — não é a ordem alfabética
// (`orderBy` do Prisma), então a ordenação final é feita em memória (ver `sortLooktypes` abaixo).
const CATEGORY_DISPLAY_ORDER: Record<string, number> = { item: 0, outfit: 1, effect: 2, missile: 3 };

function sortLooktypes<T extends { category: string; name: string }>(looktypes: T[]): T[] {
  return [...looktypes].sort((a, b) => {
    const orderDiff =
      (CATEGORY_DISPLAY_ORDER[a.category] ?? 99) - (CATEGORY_DISPLAY_ORDER[b.category] ?? 99);
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
  });
}

export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const url = new URL(request.url);

  // `?id=` faz busca exata por chave primária, ignorando os demais filtros — usado para
  // re-hidratar um valor já selecionado (ver `parseIdsParam`), nunca pela busca livre do usuário.
  const ids = parseIdsParam(url);
  if (ids) {
    const looktypesById = await prisma.looktype.findMany({ where: { id: { in: ids } } });
    return NextResponse.json(buildPaginatedResult(looktypesById, looktypesById.length, 1, looktypesById.length || 1));
  }

  const { page, pageSize, search } = parsePaginationParams(url);
  const category = url.searchParams.get("category");
  const frameCount = url.searchParams.get("frameCount");
  const size = url.searchParams.get("size");
  const frameSpeedMs = url.searchParams.get("frameSpeedMs");

  const [sizeWidth, sizeHeight] = size ? size.split("x").map(Number) : [];

  const where: Prisma.LooktypeWhereInput = {
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            ...(Number.isInteger(Number(search))
              ? [{ id: Number(search) }, { looktypeNumber: Number(search) }]
              : []),
          ],
        }
      : {}),
    ...(category ? { category } : {}),
    ...(frameCount ? { frameCount: Number(frameCount) } : {}),
    ...(size && Number.isInteger(sizeWidth) && Number.isInteger(sizeHeight)
      ? { width: sizeWidth, height: sizeHeight }
      : {}),
  };

  // Ordem custom de categoria (item -> outfit -> effect -> missile) não dá pra expressar no
  // `orderBy` do Prisma (não é alfabética), então busca tudo que bate com o filtro e ordena/pagina
  // em memória — mesmo padrão já usado abaixo para o filtro de velocidade de quadro, que também
  // não dá pra fazer via `where`.
  const looktypes = await prisma.looktype.findMany({ where });
  let sorted = sortLooktypes(looktypes);

  // Velocidade é o primeiro elemento de `frameDurationsMs` (JSON) — não dá pra filtrar via
  // `where` do Prisma.
  if (frameSpeedMs) {
    const speed = Number(frameSpeedMs);
    sorted = sorted.filter((looktype) => (looktype.frameDurationsMs as number[])?.[0] === speed);
  }

  const total = sorted.length;
  const start = (page - 1) * pageSize;
  const pageItems = sorted.slice(start, start + pageSize);

  return NextResponse.json(buildPaginatedResult(pageItems, total, page, pageSize));
});

export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const accountId = Number(session.user.id);

  const formData = await request.formData();
  const file = formData.get("file");
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const looktypeNumberRaw = formData.get("looktypeNumber");
  const looktypeNumber = looktypeNumberRaw === null || looktypeNumberRaw === "" ? null : Number(looktypeNumberRaw);
  const frameSpeedMsRaw = formData.get("frameSpeedMs");
  const frameSpeedMs = frameSpeedMsRaw === null || frameSpeedMsRaw === "" ? null : Number(frameSpeedMsRaw);
  // Preenchidos pelo dialog de criação em lote (`LooktypeCreateDialog`) — permitem correlacionar
  // as entradas de auditoria de uma mesma sessão de import e mostrar o nome do arquivo original
  // (que pode divergir do campo "nome", editável na revisão antes de enviar).
  const fileNameRaw = formData.get("fileName");
  const batchIdRaw = formData.get("batchId");
  const batchId = typeof batchIdRaw === "string" && batchIdRaw ? batchIdRaw : null;
  // Flag de sobrescrita marcada no dialog de criação — ver `LooktypeCreateDialog` e a semântica
  // de `overwriteExisting` no import de cliente (`lib/tibia-client/import-runner.ts`).
  const overwriteExisting = formData.get("overwriteExisting") === "true";

  const fileName =
    typeof fileNameRaw === "string" && fileNameRaw
      ? fileNameRaw
      : file instanceof File
        ? file.name
        : "desconhecido";

  // Registra em auditoria (action "import_error") qualquer arquivo que falhe a validação/parse
  // durante um import em lote — mesma ideia do "import_skip" (duplicata), mas para os demais
  // motivos de falha. Assim, ao final de um lote com centenas/milhares de arquivos, o admin
  // consegue ver na página de Auditoria exatamente qual arquivo falhou e por quê, sem precisar
  // que o toast (que só mostra o primeiro erro) cubra todos os casos.
  // Aguardado (não fire-and-forget) antes de cada `return`: o wrapper de auditoria
  // (`withAudit`) correlaciona os logs criados durante a requisição pelo `AsyncLocalStorage` e
  // só enxerga um `logAudit` cujo `create()` já tenha resolvido — sem o `await` aqui, a resposta
  // podia sair antes do insert terminar e o wrapper duplicava a linha (seu próprio fallback de
  // erro, achando que nada tinha sido logado).
  async function logImportError(reason: string) {
    await logAudit({
      accountId,
      action: "import_error",
      entity: "looktype",
      metadata: { fileName, name, looktypeNumber, category, reason, batchId },
    }).catch((error) => console.error("Falha ao registrar auditoria de import_error", error));
  }

  if (!(file instanceof File)) {
    await logImportError("Nenhum arquivo enviado.");
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 422 });
  }

  if (!name) {
    await logImportError("Informe um nome.");
    return NextResponse.json({ error: "Informe um nome." }, { status: 422 });
  }
  if (!(LOOKTYPE_CATEGORIES as readonly string[]).includes(category)) {
    await logImportError("Selecione o tipo (item/outfit/effect/missile).");
    return NextResponse.json({ error: "Selecione o tipo (item/outfit/effect/missile)." }, { status: 422 });
  }
  if (category !== "item" && (looktypeNumber === null || !Number.isInteger(looktypeNumber) || looktypeNumber < 0)) {
    await logImportError("Informe o número da sprite no Object Builder.");
    return NextResponse.json({ error: "Informe o número da sprite no Object Builder." }, { status: 422 });
  }

  // Descobre todos os conflitos de nome/número dentro da categoria (item/outfit/effect/missile) —
  // checado antes do parse/render do arquivo (CPU-bound) pra não desperdiçar trabalho em algo que
  // vai ser rejeitado. `findMany` (e não `findFirst`): o `looktypeNumber` não tem índice único
  // (há duplicatas legadas no banco), então com a sobrescrita marcada todos os candidatos
  // equivalentes precisam ser resolvidos de uma vez.
  const candidates = await prisma.looktype.findMany({
    where: {
      category,
      OR: [
        { name },
        ...(category !== "item" && looktypeNumber !== null ? [{ looktypeNumber }] : []),
      ],
    },
  });

  // Sem a flag de sobrescrita, o cadastro existente é preservado: arquivo cujo nome/número já
  // existe é pulado (nada é atualizado/apagado/criado). Registrado em auditoria pra o admin
  // conseguir ver depois, num import em lote, quais arquivos foram ignorados e por quê (ver
  // `app/admin/audit-logs/page.tsx`).
  if (candidates.length > 0 && !overwriteExisting) {
    const duplicate = candidates[0];
    const isNameConflict = duplicate.name.trim().toLowerCase() === name.toLowerCase();
    const reason = isNameConflict
      ? `Já existe uma sprite chamada "${name}" na categoria ${category} (#${duplicate.id}).`
      : `Já existe uma sprite com o número ${looktypeNumber} na categoria ${category} (#${duplicate.id} "${duplicate.name}").`;

    await logAudit({
      accountId,
      action: "import_skip",
      entity: "looktype",
      metadata: { fileName, name, looktypeNumber, category, reason, batchId },
    }).catch((error) => console.error("Falha ao registrar auditoria de import_skip", error));

    return NextResponse.json({ error: reason, skipped: true }, { status: 409 });
  }

  // A resolução automática da sobrescrita tem uma proibição: mais de um candidato equivalente
  // VINCULADO a algo (item/monstro/npc/vocação/spell) — aí escolher um deles pra atualizar
  // arriscaria trocar a sprite errada de um cadastro em uso, então o arquivo falha e pede
  // resolução manual. Checado antes do parse (barato, 5 queries), como no import de cliente.
  let linkedCandidateIds: Set<number> | null = null;
  if (overwriteExisting && candidates.length > 0) {
    linkedCandidateIds = await findLinkedLooktypeIds(candidates.map((candidate) => candidate.id));
    if (linkedCandidateIds.size > 1) {
      const reason = `Múltiplos looktypes existentes vinculados a algo batem com este nome/número (ids ${[
        ...linkedCandidateIds,
      ].join(", ")}) — resolução automática abortada, ajuste manualmente.`;
      await logImportError(reason);
      return NextResponse.json({ error: reason, overwriteBlocked: true }, { status: 422 });
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) {
    await logImportError("Arquivo vazio.");
    return NextResponse.json({ error: "Arquivo vazio." }, { status: 422 });
  }

  const imageExtension = detectImageExtension(buffer);

  let frames: { png: Buffer; durationMs: number }[];
  let width = 1;
  let height = 1;
  // Só preenchidos quando `category === "outfit"` e o arquivo é um `.obd` de verdade (upload de
  // imagem estática não tem direção/máscara) — ver `renderOutfitDirectionalFrames`.
  let outfitDirectional: RenderedOutfitResult | null = null;
  let outfitFrameFields: OutfitFrameFields | null = null;

  if (imageExtension) {
    if (buffer.length > MAX_IMAGE_BYTES) {
      await logImportError("Imagem maior que 2MB.");
      return NextResponse.json({ error: "Imagem maior que 2MB." }, { status: 413 });
    }
    frames = [{ png: buffer, durationMs: 100 }];
  } else {
    if (buffer.length > MAX_OBD_BYTES) {
      await logImportError("Arquivo OBD maior que 8MB.");
      return NextResponse.json({ error: "Arquivo OBD maior que 8MB." }, { status: 413 });
    }
    try {
      const thing = await parseObd(buffer);
      width = thing.width;
      height = thing.height;
      frames = renderLooktypeFrames(thing, frameSpeedMs);
      if (category === "outfit") {
        outfitDirectional = renderOutfitDirectionalFrames(thing, frameSpeedMs);
        outfitFrameFields = outfitFrameFieldsFrom(outfitDirectional);
      }
    } catch (error) {
      const message = error instanceof ObdParseError ? error.message : "Não foi possível interpretar o arquivo.";
      await logImportError(message);
      return NextResponse.json({ error: message }, { status: 422 });
    }
  }

  // Remove um looktype (linha + diretório de frames) — só chamado em candidatos duplicados NÃO
  // vinculados (apagar um vinculado quebraria a referência que o usa).
  async function removeLooktypeRow(id: number) {
    await prisma.looktype.delete({ where: { id } }).catch(() => null);
    await fs.rm(looktypeFrameDirPath(id), { recursive: true, force: true }).catch(() => null);
  }

  // Grava os frames renderizados no diretório do looktype, recriando-o — o update no lugar apaga
  // os frames antigos no passo anterior.
  async function persistFrames(looktypeId: number) {
    const frameDir = looktypeFrameDirPath(looktypeId);
    await fs.mkdir(frameDir, { recursive: true });
    await Promise.all(
      frames.map((frame, index) => fs.writeFile(looktypeFrameStoragePath(looktypeId, index), frame.png)),
    );

    if (!outfitDirectional) return;
    await writeOutfitDirectionalFrames(looktypeId, outfitDirectional);
  }

  // Sobrescreve candidatos equivalentes NO LUGAR (mesmo id), preservando as referências de quem
  // os usa (item/monstro/npc/vocação/spell). Prioriza o candidato vinculado (no máximo 1 aqui, os
  // demais já foram rejeitados acima), senão o de nome igual, senão o de menor id; remove da
  // sequência só os não vinculados (não faz sentido manter duas sprites iguais). Grava os frames
  // novos e registra em auditoria (action "update").
  async function overwriteCandidates(rows: { id: number; name: string }[], linkedIds: Set<number>) {
    const canonical =
      rows.find((row) => linkedIds.has(row.id)) ??
      rows.find((row) => row.name === name) ??
      rows.reduce((best, row) => (row.id < best.id ? row : best), rows[0]);

    await Promise.all(
      rows
        .filter((row) => row.id !== canonical.id && !linkedIds.has(row.id))
        .map((row) => removeLooktypeRow(row.id)),
    );

    await fs.rm(looktypeFrameDirPath(canonical.id), { recursive: true, force: true }).catch(() => null);
    const updated = await prisma.looktype.update({
      where: { id: canonical.id },
      data: {
        name,
        ...(category !== "item" && looktypeNumber !== null ? { looktypeNumber } : {}),
        width,
        height,
        frameCount: frames.length,
        frameDurationsMs: frames.map((frame) => frame.durationMs),
        directions: outfitFrameFields?.directions ?? 1,
        hasColorMask: outfitFrameFields?.hasColorMask ?? false,
        addonSlots: outfitFrameFields?.addonSlots ?? 0,
      },
    });

    await persistFrames(updated.id);

    await logAudit({
      accountId,
      action: "update",
      entity: "looktype",
      entityId: updated.id,
      metadata: {
        fileName,
        name,
        category,
        looktypeNumber,
        frameCount: frames.length,
        batchId,
        overwriteExisting: true,
      },
    }).catch((error) => console.error("Falha ao registrar auditoria de update", error));

    return updated;
  }

  // Sobrescrita marcada + candidato(s) equivalente(s) no banco: atualiza no lugar em vez de criar.
  if (overwriteExisting && candidates.length > 0) {
    const updated = await overwriteCandidates(candidates, linkedCandidateIds ?? new Set());
    return NextResponse.json({ looktype: updated, overwritten: true });
  }

  let looktype;
  try {
    looktype = await prisma.looktype.create({
      data: {
        name,
        category,
        looktypeNumber: category === "item" ? null : looktypeNumber,
        width,
        height,
        frameCount: frames.length,
        frameDurationsMs: frames.map((frame) => frame.durationMs),
        directions: outfitFrameFields?.directions ?? 1,
        hasColorMask: outfitFrameFields?.hasColorMask ?? false,
        addonSlots: outfitFrameFields?.addonSlots ?? 0,
      },
    });
  } catch (error) {
    // Corrida entre requisições concorrentes do mesmo lote (upload em paralelo, ver
    // `UPLOAD_CONCURRENCY` no dialog) que passaram pela checagem acima antes de qualquer uma
    // criar o registro — o índice único em (category, name) pega o que a checagem otimista deixa
    // passar.
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      if (overwriteExisting) {
        // Com a sobrescrita marcada a corrida vira update no lugar (a sprite que "venceu" recebe
        // os frames recém-renderizados) em vez de um skip silencioso.
        const conflict = await prisma.looktype.findFirst({
          where: { category, name },
          select: { id: true, name: true },
        });
        if (conflict) {
          const updated = await overwriteCandidates([conflict], new Set());
          return NextResponse.json({ looktype: updated, overwritten: true });
        }
      }
      const reason = `Já existe uma sprite chamada "${name}" na categoria ${category}.`;
      await logAudit({
        accountId,
        action: "import_skip",
        entity: "looktype",
        metadata: { fileName, name, looktypeNumber, category, reason, batchId },
      }).catch((error) => console.error("Falha ao registrar auditoria de import_skip", error));
      return NextResponse.json({ error: reason, skipped: true }, { status: 409 });
    }
    await logImportError(error instanceof Error ? error.message : "Erro inesperado ao salvar a sprite.");
    throw error;
  }

  await persistFrames(looktype.id);

  await logAudit({
    accountId,
    action: "create",
    entity: "looktype",
    entityId: looktype.id,
    metadata: { fileName, name, category, looktypeNumber, frameCount: frames.length, batchId },
  }).catch((error) => console.error("Falha ao registrar auditoria de create", error));

  return NextResponse.json({ looktype }, { status: 201 });
});
