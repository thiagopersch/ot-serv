"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ServerFileTree } from "@/components/admin/lua-scripts/server-file-tree";
import { ServerFileEditor } from "@/components/shared/server-file-editor";

type FileState = {
  path: string;
  content: string;
  category: string | null;
  luaScriptId: number | null;
};

function isPathAffectedByDeletion(
  filePath: string,
  deletedPath: string,
  deletedType: "file" | "directory",
): boolean {
  if (filePath === deletedPath) return true;
  if (deletedType !== "directory") return false;
  return filePath.startsWith(`${deletedPath}/`) || filePath.startsWith(`${deletedPath}\\`);
}

/** Explorador de arquivos do servidor (`/admin/lua-scripts/explorer`, só Admin Master) —
 * árvore à esquerda lendo direto da raiz real do servidor no disco (`lib/server-files.ts`),
 * editor de código à direita. Salvar grava no arquivo em disco e, quando o arquivo é um
 * `.lua` dentro de uma pasta de categoria reconhecida, também sincroniza o registro
 * correspondente na tabela `LuaScript` (ver `PUT /api/admin/server-files/content`). */
export function ServerFileExplorer() {
  const [file, setFile] = useState<FileState | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = file !== null && draftContent !== file.content;

  async function handleSelectFile(path: string) {
    setIsLoadingFile(true);
    try {
      const response = await fetch(`/api/admin/server-files/content?path=${encodeURIComponent(path)}`);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        toast.error(data?.error ?? "Não foi possível abrir o arquivo.");
        return;
      }

      setFile(data);
      setDraftContent(data.content);
    } finally {
      setIsLoadingFile(false);
    }
  }

  async function handleSave() {
    if (!file) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/server-files/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: file.path, content: draftContent }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        toast.error(data?.error ?? "Não foi possível salvar o arquivo.");
        return;
      }

      setFile({ ...file, content: draftContent });
      toast.success(
        data.linkedLuaScriptId
          ? "Arquivo salvo no servidor e sincronizado com o script no banco."
          : "Arquivo salvo no servidor.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleDeleted(path: string, type: "file" | "directory") {
    if (file && isPathAffectedByDeletion(file.path, path, type)) {
      setFile(null);
    }
  }

  return (
    <div className="flex h-[calc(100vh-14rem)] min-h-[500px] gap-4">
      <div className="w-72 shrink-0 overflow-y-auto rounded-md border p-2">
        <ServerFileTree
          selectedPath={file?.path ?? null}
          onSelectFile={handleSelectFile}
          onDeleted={handleDeleted}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {file ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <code className="truncate text-sm text-muted-foreground">{file.path}</code>
                {file.category && (
                  <Badge variant="secondary" title="Sincroniza com a tabela LuaScript ao salvar">
                    {file.category}
                    {file.luaScriptId ? ` · #${file.luaScriptId}` : " · novo registro"}
                  </Badge>
                )}
                {isDirty && <Badge variant="outline">Não salvo</Badge>}
              </div>
              <Button size="sm" onClick={handleSave} disabled={!isDirty || isSaving}>
                <Save className="size-4" />
                {isSaving ? "Salvando..." : "Salvar"}
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-input">
              <ServerFileEditor
                fileName={file.path}
                value={draftContent}
                onChange={setDraftContent}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-md border text-sm text-muted-foreground">
            {isLoadingFile ? "Abrindo arquivo..." : "Selecione um arquivo na árvore para editar."}
          </div>
        )}
      </div>
    </div>
  );
}
