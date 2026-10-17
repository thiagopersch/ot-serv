import fs from "node:fs/promises";
import path from "node:path";

import { prisma } from "@/lib/prisma";
import { itemRowToFormInput } from "@/lib/item-mapper";
import { itemToXml } from "@/lib/item-xml";
import { indent } from "@/lib/xml-utils";

/** Itens lidos do banco (e serializados) por página durante a sincronização. */
const SYNC_PAGE_SIZE = 500;

export function getItemsXmlPath(): string {
  const base = process.env.OTSERVER_DATA_PATH;
  if (!base) {
    throw new Error("OTSERVER_DATA_PATH não configurado (.env)");
  }
  return path.join(base, "items", "items.xml");
}

export type SyncItemsXmlStage = "config" | "database" | "file";

/** Erro da sincronização já traduzido para o usuário: em que etapa parou e como resolver. */
export class SyncItemsXmlError extends Error {
  constructor(
    public readonly stage: SyncItemsXmlStage,
    message: string,
    public readonly hint: string,
    public readonly processed: number,
  ) {
    super(message);
    this.name = "SyncItemsXmlError";
  }
}

export type SyncItemsXmlProgress = { processed: number; total: number; percent: number };

export type SyncItemsXmlResult = { total: number };

function describeFsError(error: unknown): { message: string; hint: string } {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  const detail = error instanceof Error ? error.message : String(error);

  switch (code) {
    case "EACCES":
    case "EPERM":
    case "EBUSY":
      return {
        message: `Sem permissão para gravar o items.xml, ou o arquivo está em uso (${code}).`,
        hint: "Feche programas que estejam com o items.xml aberto (editor, RME, servidor) e confira a permissão de escrita da pasta em OTSERVER_DATA_PATH.",
      };
    case "ENOENT":
      return {
        message: "A pasta de destino do items.xml não existe (ENOENT).",
        hint: "Verifique se OTSERVER_DATA_PATH, no .env, aponta para a pasta data do servidor.",
      };
    case "ENOSPC":
      return {
        message: "Não há espaço em disco para gravar o items.xml (ENOSPC).",
        hint: "Libere espaço no disco do servidor e tente sincronizar novamente.",
      };
    default:
      return {
        message: `Falha ao gravar o items.xml: ${detail}`,
        hint: "Confira o caminho e as permissões do arquivo. Se o problema persistir, consulte o log do servidor.",
      };
  }
}

/**
 * Ação manual (Processos → "Sincronizar items.xml"): sobrescreve por completo o `items.xml` do disco
 * com o conteúdo da tabela `items` (o banco é a fonte da verdade; nada do arquivo é preservado).
 * Lê o banco em páginas por id e grava num `.tmp` ao lado do arquivo; só troca o `items.xml` no
 * final (`rename`), então, se algo falhar no meio, o arquivo original permanece intacto. Reporta o
 * progresso via `onProgress` e lança `SyncItemsXmlError` na primeira falha.
 */
export async function syncItemsXmlFromDatabase(
  onProgress?: (progress: SyncItemsXmlProgress) => void,
): Promise<SyncItemsXmlResult> {
  let processed = 0;

  let xmlPath: string;
  try {
    xmlPath = getItemsXmlPath();
  } catch (error) {
    throw new SyncItemsXmlError(
      "config",
      error instanceof Error ? error.message : String(error),
      "Defina OTSERVER_DATA_PATH no .env com o caminho da pasta data do servidor e reinicie o portal.",
      processed,
    );
  }

  let total: number;
  try {
    total = await prisma.item.count();
  } catch (error) {
    throw new SyncItemsXmlError(
      "database",
      `Não foi possível ler os items do banco: ${error instanceof Error ? error.message : String(error)}`,
      "Verifique se o MySQL está ativo e se DATABASE_URL está correto, e tente novamente.",
      processed,
    );
  }

  const report = () =>
    onProgress?.({ processed, total, percent: total === 0 ? 100 : Math.floor((processed / total) * 100) });

  const tmpPath = `${xmlPath}.tmp`;
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
  let stage: SyncItemsXmlStage = "file";

  try {
    await fs.mkdir(path.dirname(xmlPath), { recursive: true });
    handle = await fs.open(tmpPath, "w");
    await handle.write(`<?xml version="1.0" encoding="ISO-8859-1"?>\n<items>\n`, null, "utf-8");
    report();

    let lastId = -1;
    for (;;) {
      stage = "database";
      const rows = await prisma.item.findMany({
        where: { id: { gt: lastId } },
        orderBy: { id: "asc" },
        take: SYNC_PAGE_SIZE,
      });
      if (rows.length === 0) break;

      stage = "file";
      const lines: string[] = [];
      for (const row of rows) {
        lines.push(...indent(itemToXml(itemRowToFormInput(row)).split("\n"), 1));
      }
      await handle.write(lines.join("\n") + "\n", null, "utf-8");

      lastId = rows[rows.length - 1].id;
      processed += rows.length;
      report();
    }

    await handle.write(`</items>\n`, null, "utf-8");
    await handle.close();
    handle = undefined;
    await fs.rename(tmpPath, xmlPath);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await fs.rm(tmpPath, { force: true }).catch(() => undefined);

    if (error instanceof SyncItemsXmlError) throw error;

    if (stage === "database") {
      throw new SyncItemsXmlError(
        "database",
        `Falha ao ler os items do banco: ${error instanceof Error ? error.message : String(error)}`,
        "Verifique se o MySQL está ativo e acessível e tente novamente. O items.xml original não foi alterado.",
        processed,
      );
    }

    const { message, hint } = describeFsError(error);
    throw new SyncItemsXmlError("file", message, `${hint} O items.xml original não foi alterado.`, processed);
  }

  return { total: processed };
}
