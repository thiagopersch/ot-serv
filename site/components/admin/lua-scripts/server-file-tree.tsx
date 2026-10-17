"use client";

import { useEffect, useState } from "react";
import { ChevronRight, File, Folder, FolderOpen, Loader2, Trash2 } from "lucide-react";
import { ContextMenu } from "@base-ui/react/context-menu";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { fetcher } from "@/lib/fetcher";
import { Collapsible, CollapsibleTrigger, CollapsiblePanel } from "@/components/ui/collapsible";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

export type ServerFileTreeEntry = {
  name: string;
  path: string;
  type: "file" | "directory";
};

const deleteMenuItemClass =
  "flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive outline-hidden select-none data-highlighted:bg-destructive/10 [&_svg]:size-4";

const deleteMenuPopupClass =
  "z-50 min-w-36 origin-(--transform-origin) rounded-md bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none";

type DeleteMenuProps = {
  onSelectDelete: () => void;
};

/** Item único "Excluir" do menu de contexto (botão direito) — reaproveitado tanto pelo nó de
 * arquivo quanto de pasta, sempre chamando o mesmo fluxo de confirmação do ícone de lixeira. */
function DeleteContextMenu({ onSelectDelete }: DeleteMenuProps) {
  return (
    <ContextMenu.Portal>
      <ContextMenu.Positioner className="isolate z-50 outline-none">
        <ContextMenu.Popup className={deleteMenuPopupClass}>
          <ContextMenu.Item className={deleteMenuItemClass} onClick={onSelectDelete}>
            <Trash2 />
            Excluir
          </ContextMenu.Item>
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  );
}

type ServerFileTreeNodeProps = {
  entry: ServerFileTreeEntry;
  depth: number;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  onDeleted: (path: string, type: "file" | "directory") => void;
};

function ServerFileTreeNode({ entry, depth, selectedPath, onSelectFile, onDeleted }: ServerFileTreeNodeProps) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<ServerFileTreeEntry[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const indent = { paddingLeft: `${depth * 14 + 8}px` };

  function handleChildDeleted(path: string, type: "file" | "directory") {
    setChildren((current) => current?.filter((child) => child.path !== path) ?? current);
    onDeleted(path, type);
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/admin/server-files/content?path=${encodeURIComponent(entry.path)}`,
        { method: "DELETE" },
      );
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        toast.error(data?.error ?? "Não foi possível excluir.");
        return;
      }

      toast.success(entry.type === "directory" ? "Pasta excluída." : "Arquivo excluído.");
      setConfirmOpen(false);
      onDeleted(entry.path, entry.type);
    } finally {
      setIsDeleting(false);
    }
  }

  const confirmDialog = (
    <ConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      title={entry.type === "directory" ? "Excluir pasta" : "Excluir arquivo"}
      description={
        entry.type === "directory"
          ? `Isso apaga "${entry.name}" e todo o conteúdo dela do disco, permanentemente. Scripts Lua vinculados dentro dela são marcados como removidos.`
          : `Isso apaga "${entry.name}" do disco, permanentemente. Se houver um script Lua vinculado a ele, é marcado como removido.`
      }
      confirmLabel={isDeleting ? "Excluindo..." : "Excluir"}
      onConfirm={handleDelete}
    />
  );

  if (entry.type === "file") {
    const isSelected = selectedPath === entry.path;
    return (
      <div className="group relative">
        <ContextMenu.Root>
          <ContextMenu.Trigger>
            <button
              type="button"
              onClick={() => onSelectFile(entry.path)}
              className={cn(
                "flex w-full items-center gap-1.5 rounded-sm py-1 pr-6 text-left text-sm hover:bg-accent",
                isSelected && "bg-accent font-medium",
              )}
              style={indent}
              title={entry.path}
            >
              <File className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{entry.name}</span>
            </button>
          </ContextMenu.Trigger>
          <DeleteContextMenu onSelectDelete={() => setConfirmOpen(true)} />
        </ContextMenu.Root>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setConfirmOpen(true);
          }}
          className="absolute top-1/2 right-1 -translate-y-1/2 rounded-sm p-1 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          title="Excluir arquivo"
        >
          <Trash2 className="size-3.5" />
        </button>
        {confirmDialog}
      </div>
    );
  }

  async function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen && children === null && !isLoading) {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetcher<{ entries: ServerFileTreeEntry[] }>(
          `/api/admin/server-files/tree?path=${encodeURIComponent(entry.path)}`,
        );
        setChildren(data.entries);
      } catch {
        setError("Não foi possível carregar esta pasta.");
      } finally {
        setIsLoading(false);
      }
    }
  }

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange}>
      <div className="group relative">
        <ContextMenu.Root>
          <ContextMenu.Trigger>
            <CollapsibleTrigger
              className="flex w-full items-center gap-1.5 rounded-sm py-1 pr-6 text-left text-sm hover:bg-accent"
              style={indent}
              title={entry.path}
            >
              <ChevronRight
                className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-90")}
              />
              {open ? (
                <FolderOpen className="size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <Folder className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">{entry.name}</span>
              {isLoading && <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />}
            </CollapsibleTrigger>
          </ContextMenu.Trigger>
          <DeleteContextMenu onSelectDelete={() => setConfirmOpen(true)} />
        </ContextMenu.Root>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setConfirmOpen(true);
          }}
          className="absolute top-1/2 right-1 -translate-y-1/2 rounded-sm p-1 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          title="Excluir pasta"
        >
          <Trash2 className="size-3.5" />
        </button>
        {confirmDialog}
      </div>
      <CollapsiblePanel className="gap-0 pt-0">
        {error && (
          <p className="text-xs text-destructive" style={{ paddingLeft: `${(depth + 1) * 14 + 8}px` }}>
            {error}
          </p>
        )}
        {children?.map((child) => (
          <ServerFileTreeNode
            key={child.path}
            entry={child}
            depth={depth + 1}
            selectedPath={selectedPath}
            onSelectFile={onSelectFile}
            onDeleted={handleChildDeleted}
          />
        ))}
      </CollapsiblePanel>
    </Collapsible>
  );
}

type ServerFileTreeProps = {
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  onDeleted?: (path: string, type: "file" | "directory") => void;
};

/** Árvore de arquivos do servidor (raiz de `OTSERVER_ROOT_PATH`/`OTSERVER_DATA_PATH`, ver
 * `lib/server-files.ts`) com carregamento sob demanda — só busca os filhos de uma pasta quando
 * ela é expandida (a árvore inteira tem milhares de arquivos, boa parte deles irrelevante pra
 * esse propósito, ex. o editor de mapas `RME/`). */
export function ServerFileTree({ selectedPath, onSelectFile, onDeleted }: ServerFileTreeProps) {
  const [entries, setEntries] = useState<ServerFileTreeEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetcher<{ entries: ServerFileTreeEntry[] }>("/api/admin/server-files/tree?path=")
      .then((data) => {
        if (!cancelled) setEntries(data.entries);
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível carregar a raiz do servidor.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleDeleted(path: string, type: "file" | "directory") {
    setEntries((current) => current?.filter((entry) => entry.path !== path) ?? current);
    onDeleted?.(path, type);
  }

  if (error) return <p className="p-2 text-sm text-destructive">{error}</p>;
  if (entries === null) return <p className="p-2 text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="flex flex-col">
      {entries.map((entry) => (
        <ServerFileTreeNode
          key={entry.path}
          entry={entry}
          depth={0}
          selectedPath={selectedPath}
          onSelectFile={onSelectFile}
          onDeleted={handleDeleted}
        />
      ))}
    </div>
  );
}
