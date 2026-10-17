import path from "node:path";
import fs from "node:fs/promises";

import { LUA_SCRIPT_CATEGORIES, type LuaScriptCategory } from "@/lib/validations/admin/lua-script";

/** Extensões de "código/texto" navegáveis/abríveis no Explorador do servidor
 * (`/admin/lua-scripts/explorer`) — qualquer outra extensão (`.dll`, `.exe`, `.otb`, `.otbm`,
 * `.db`, `.s3db`, imagens, etc.) nunca aparece como arquivo abrível; pastas continuam sempre
 * navegáveis independente do que contêm. */
export const ALLOWED_SERVER_FILE_EXTENSIONS = new Set([
  ".lua",
  ".xml",
  ".json",
  ".sql",
  ".py",
  ".cfg",
  ".conf",
  ".ini",
  ".yml",
  ".yaml",
  ".txt",
  ".md",
  ".cmake",
  ".sh",
  ".bat",
  ".ps1",
  ".cpp",
  ".cc",
  ".cxx",
  ".h",
  ".hpp",
  ".c",
  ".css",
  ".js",
  ".ts",
  ".html",
  ".htm",
]);

/** Tamanho máximo de leitura (5 MB) — evita travar o editor com arquivos de dados grandes
 * (ex. `items.xml` do RME) que tecnicamente batem na allowlist de extensão. */
export const MAX_SERVER_FILE_READ_BYTES = 5 * 1024 * 1024;

export function isAllowedServerFile(fileName: string): boolean {
  return ALLOWED_SERVER_FILE_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

/** Raiz do diretório real do servidor OTServer no disco (não só `data/`) — `OTSERVER_ROOT_PATH`
 * se definida, senão derivada de `OTSERVER_DATA_PATH` (já configurada, aponta para
 * `.../server/data`; a raiz do servidor é o diretório pai). */
export function getServerRootPath(): string {
  const explicit = process.env.OTSERVER_ROOT_PATH;
  if (explicit) return explicit;

  const dataPath = process.env.OTSERVER_DATA_PATH;
  if (!dataPath) {
    throw new Error("OTSERVER_ROOT_PATH/OTSERVER_DATA_PATH não configurado (.env)");
  }
  return path.dirname(dataPath);
}

export class InvalidServerPathError extends Error {}

/** Resolve um caminho relativo (vindo do cliente) dentro da raiz do servidor, rejeitando
 * qualquer resultado fora dela (`..`, paths absolutos disfarçados etc.) — não existe path
 * traversal-safe em nenhum outro lugar do projeto hoje (`lib/npc-generator.ts` nunca recebe
 * segmento de path vindo do cliente, então nunca precisou disso). */
export function resolveServerPath(relativePath: string): { absolutePath: string; root: string } {
  const root = path.resolve(getServerRootPath());
  const absolutePath = path.resolve(root, relativePath || ".");

  if (absolutePath !== root && !absolutePath.startsWith(root + path.sep)) {
    throw new InvalidServerPathError("Caminho fora do diretório do servidor.");
  }

  return { absolutePath, root };
}

/** Categoria de `LuaScript` inferida pelo caminho (`data/{categoria}/scripts/*.lua`) —
 * percorre os segmentos do caminho relativo procurando um que bata com
 * `LUA_SCRIPT_CATEGORIES`. Retorna `null` quando o arquivo não está em nenhuma pasta de
 * categoria reconhecida (ex. `server/config.lua`, ou fora de `.lua`). */
export function inferLuaScriptCategory(relativePath: string): LuaScriptCategory | null {
  const segments = relativePath.split(/[\\/]/).map((segment) => segment.toLowerCase());
  const match = LUA_SCRIPT_CATEGORIES.find((category) => segments.includes(category));
  return match ?? null;
}

export type ServerFileTreeEntry = {
  name: string;
  path: string;
  type: "file" | "directory";
};

/** Lista os filhos imediatos (não recursivo — a árvore da UI carrega sob demanda) de uma pasta
 * dentro da raiz do servidor, pastas primeiro e depois arquivos, ambos em ordem alfabética.
 * Arquivos fora da allowlist de extensão são omitidos; pastas aparecem sempre, mesmo vazias
 * depois do filtro (para não escondê-las por conterem só binários, por ex.). */
export async function listServerDirectory(relativePath: string): Promise<ServerFileTreeEntry[]> {
  const { absolutePath } = resolveServerPath(relativePath);
  const dirents = await fs.readdir(absolutePath, { withFileTypes: true });

  const directories: ServerFileTreeEntry[] = [];
  const files: ServerFileTreeEntry[] = [];

  for (const dirent of dirents) {
    // Ignora symlinks — não seguimos links simbólicos (risco de loop/escape da raiz sem
    // necessidade real para navegar scripts/arquivos de configuração do servidor).
    if (dirent.isSymbolicLink()) continue;

    const entryRelativePath = path.join(relativePath, dirent.name);

    if (dirent.isDirectory()) {
      directories.push({ name: dirent.name, path: entryRelativePath, type: "directory" });
    } else if (dirent.isFile() && isAllowedServerFile(dirent.name)) {
      files.push({ name: dirent.name, path: entryRelativePath, type: "file" });
    }
  }

  const byName = (a: ServerFileTreeEntry, b: ServerFileTreeEntry) =>
    a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });

  return [...directories.sort(byName), ...files.sort(byName)];
}

export async function readServerFile(relativePath: string): Promise<string> {
  const { absolutePath } = resolveServerPath(relativePath);

  if (!isAllowedServerFile(absolutePath)) {
    throw new InvalidServerPathError("Extensão de arquivo não permitida.");
  }

  const stat = await fs.stat(absolutePath);
  if (!stat.isFile()) {
    throw new InvalidServerPathError("Caminho não é um arquivo.");
  }
  if (stat.size > MAX_SERVER_FILE_READ_BYTES) {
    throw new InvalidServerPathError("Arquivo muito grande para abrir no editor.");
  }

  return fs.readFile(absolutePath, "utf-8");
}

export async function writeServerFile(relativePath: string, content: string): Promise<void> {
  const { absolutePath } = resolveServerPath(relativePath);

  if (!isAllowedServerFile(absolutePath)) {
    throw new InvalidServerPathError("Extensão de arquivo não permitida.");
  }

  const stat = await fs.stat(absolutePath);
  if (!stat.isFile()) {
    throw new InvalidServerPathError("Caminho não é um arquivo.");
  }

  await fs.writeFile(absolutePath, content, "utf-8");
}

/** Apaga um arquivo ou pasta (recursivamente) dentro da raiz do servidor — usado pela exclusão
 * no Explorador do servidor. Nunca permite apagar a raiz em si. */
export async function deleteServerFile(relativePath: string): Promise<void> {
  const { absolutePath, root } = resolveServerPath(relativePath);

  if (absolutePath === root) {
    throw new InvalidServerPathError("Não é possível excluir a raiz do servidor.");
  }

  const stat = await fs.stat(absolutePath);

  if (stat.isDirectory()) {
    await fs.rm(absolutePath, { recursive: true });
  } else if (stat.isFile()) {
    if (!isAllowedServerFile(absolutePath)) {
      throw new InvalidServerPathError("Extensão de arquivo não permitida.");
    }
    await fs.unlink(absolutePath);
  } else {
    throw new InvalidServerPathError("Caminho inválido.");
  }
}

/** Percorre recursivamente uma pasta (mesma raiz/regras de `listServerDirectory`, ignorando
 * symlinks) coletando o caminho relativo de todo `.lua` encontrado — usado para descobrir quais
 * `LuaScript` soft-deletar antes de apagar uma pasta inteira do disco. */
export async function collectLuaFilesRecursive(relativePath: string): Promise<string[]> {
  const { absolutePath } = resolveServerPath(relativePath);
  const dirents = await fs.readdir(absolutePath, { withFileTypes: true });

  const luaFiles: string[] = [];

  for (const dirent of dirents) {
    if (dirent.isSymbolicLink()) continue;

    const entryRelativePath = path.join(relativePath, dirent.name);

    if (dirent.isDirectory()) {
      luaFiles.push(...(await collectLuaFilesRecursive(entryRelativePath)));
    } else if (dirent.isFile() && path.extname(dirent.name).toLowerCase() === ".lua") {
      luaFiles.push(entryRelativePath);
    }
  }

  return luaFiles;
}
