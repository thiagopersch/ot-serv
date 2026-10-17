"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, Maximize2, Minimize2, X } from "lucide-react";

import type { ItemInput } from "@/lib/validations/admin/item";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ItemForm, type ItemFormHandle } from "@/components/admin/items/item-form";
import {
  ItemConflictDialog,
  type ItemConflict,
  type ItemConflictDecision,
} from "@/components/admin/items/item-conflict-dialog";

type BulkEntry = {
  key: string;
  /** null = ainda não existe no banco (duplicata criada dentro do dialog, não salva ainda). */
  itemId: number | null;
  initialValues: ItemInput;
  label: string;
};

type ConflictState = ItemConflict & {
  resolve: (decision: ItemConflictDecision) => void;
};

type BulkEditItemsDialogProps = {
  ids: number[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado depois que TODOS os items pendentes são salvos com sucesso — o caller normalmente
   * dá `mutate()` na listagem e limpa a seleção. */
  onSaved: () => void;
};

/** Edição em massa: abre um `ItemForm` completo (modo "embedded", sem botões próprios) para
 * cada item selecionado, dentro de um accordion, e salva tudo com um único clique — cada painel
 * tem seu próprio `useForm` isolado (via `ItemFormHandle`), então nenhuma edição de um item
 * pode vazar/mesclar com a de outro. */
export function BulkEditItemsDialog({ ids, open, onOpenChange, onSaved }: BulkEditItemsDialogProps) {
  const [entries, setEntries] = useState<BulkEntry[]>([]);
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [conflict, setConflict] = useState<ConflictState | null>(null);

  const handlesRef = useRef<Map<string, ItemFormHandle>>(new Map());

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    // setTimeout (e não uma chamada direta) evita que o carregamento inicial dispare setState
    // síncrono dentro do corpo do efeito — vira uma chamada em callback, como um fetch/timer
    // externo de verdade.
    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      setLoading(ids.length > 0);
      setEntries([]);

      Promise.all(
        ids.map((id) =>
          fetch(`/api/admin/items/${id}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => (data?.item ? { id, item: data.item as ItemInput } : null))
            .catch(() => null),
        ),
      ).then((results) => {
        if (cancelled) return;
        const loaded = results.filter((r): r is { id: number; item: ItemInput } => r != null);
        const missing = results.length - loaded.length;
        if (missing > 0) toast.error(`${missing} item(ns) não puderam ser carregados.`);

        const nextEntries = loaded.map(({ id, item }) => ({
          key: `item-${id}`,
          itemId: id,
          initialValues: item,
          label: `#${item.id} — ${item.name}`,
        }));
        setEntries(nextEntries);
        setOpenKeys(nextEntries.map((entry) => entry.key));
        setLoading(false);
      });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só recarrega quando o dialog abre com um novo conjunto de ids, não a cada render (`ids` é um array novo a cada render do caller)
  }, [open, ids.join(",")]);

  function guardedOnOpenChange(next: boolean, eventDetails?: { reason?: string }) {
    // Só deixa fechar quando a própria UI do dialog pede explicitamente (botão Cancelar
    // confirmado, ou depois de salvar tudo com sucesso) — nunca por clique fora, Esc, etc.
    if (!next && eventDetails?.reason !== "imperative-action") return;
    onOpenChange(next);
  }

  function handleDuplicate(entry: BulkEntry) {
    const handle = handlesRef.current.get(entry.key);
    if (!handle) return;
    const values = handle.getValues();
    const newEntry: BulkEntry = {
      key: `dup-${crypto.randomUUID()}`,
      itemId: null,
      initialValues: { ...values, name: `${values.name} (cópia)` },
      label: `#${values.id} (cópia) — ${values.name}`,
    };

    setEntries((current) => {
      const index = current.findIndex((e) => e.key === entry.key);
      const next = [...current];
      next.splice(index + 1, 0, newEntry);
      return next;
    });
    setOpenKeys((current) => [...current, newEntry.key]);
  }

  function handleRemoveEntry(entry: BulkEntry) {
    handlesRef.current.delete(entry.key);
    setEntries((current) => current.filter((e) => e.key !== entry.key));
    setOpenKeys((current) => current.filter((key) => key !== entry.key));
  }

  /** Mostra a comparação com o item existente que colidiu (409 no create — o próprio 409 já traz
   * o cadastro atual; sem ele, busca) e espera a decisão do admin. Resolve `true` só depois que
   * a sobrescrita (PATCH forçado) realmente deu certo. */
  async function resolveConflict(
    entry: BulkEntry,
    handle: ItemFormHandle,
    existingFromConflict?: ItemInput,
  ): Promise<boolean> {
    const values = handle.getValues();
    const existing =
      existingFromConflict ??
      (await fetch(`/api/admin/items/${values.id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => (data?.item as ItemInput | undefined) ?? null)
        .catch(() => null));

    if (!existing) {
      toast.error(`Não foi possível carregar o item #${values.id} para comparar.`);
      return false;
    }

    return new Promise<boolean>((resolve) => {
      setConflict({
        existing,
        incoming: values,
        resolve: async (decision) => {
          setConflict(null);
          if (decision === "skip") {
            resolve(false);
            return;
          }
          const result = await handle.submit({ forceOverwrite: true });
          if (!result.ok) toast.error(`${entry.label}: ${result.error}`);
          resolve(result.ok);
        },
      });
    });
  }

  async function handleSaveAll() {
    setSaving(true);
    const failures: string[] = [];

    for (const entry of entries) {
      const handle = handlesRef.current.get(entry.key);
      if (!handle) continue;

      const result = await handle.submit();
      if (result.ok) continue;

      if (result.conflict) {
        const resolved = await resolveConflict(entry, handle, result.existing);
        if (!resolved) failures.push(entry.label);
        continue;
      }

      failures.push(`${entry.label}: ${result.error}`);
    }

    setSaving(false);

    if (failures.length === 0) {
      toast.success(`${entries.length} item(ns) salvos.`);
      onSaved();
      onOpenChange(false);
      return;
    }

    toast.error(`${failures.length} item(ns) não foram salvos: ${failures.join("; ")}`);
  }

  return (
    <>
      <Dialog open={open} disablePointerDismissal onOpenChange={guardedOnOpenChange}>
        <DialogContent
          showCloseButton={false}
          className={cn(
            "flex flex-col gap-4 sm:max-w-none",
            expanded ? "h-[99vh] w-[99vw]" : "h-[70vh] w-[70vw]",
          )}
        >
          <DialogHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <DialogTitle>Editar items selecionados em massa</DialogTitle>
              <DialogDescription>
                Cada item abaixo é salvo individualmente, no seu próprio cadastro — nenhuma
                alteração é misturada entre eles.
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? "Reduzir" : "Expandir"}
            >
              {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </Button>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando items...</p>
            ) : entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum item carregado.</p>
            ) : (
              <Accordion
                multiple
                keepMounted
                value={openKeys}
                onValueChange={(value) => setOpenKeys(value as string[])}
                className="flex flex-col gap-3"
              >
                {entries.map((entry) => (
                  <AccordionItem key={entry.key} value={entry.key}>
                    <div className="flex items-center gap-1">
                      <AccordionTrigger className="flex-1">
                        <span className="flex flex-1 items-center gap-2">
                          {entry.label}
                          {entry.itemId == null && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                              novo / cópia
                            </span>
                          )}
                        </span>
                      </AccordionTrigger>
                      <div className="flex items-center gap-1 pr-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          title="Duplicar este item"
                          onClick={() => handleDuplicate(entry)}
                        >
                          <Copy className="size-4" />
                        </Button>
                        {entry.itemId == null && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title="Remover esta cópia"
                            onClick={() => handleRemoveEntry(entry)}
                          >
                            <X className="size-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <AccordionPanel>
                      <ItemForm
                        ref={(handle) => {
                          if (handle) handlesRef.current.set(entry.key, handle);
                          else handlesRef.current.delete(entry.key);
                        }}
                        mode="embedded"
                        itemId={entry.itemId ?? undefined}
                        initialValues={entry.initialValues}
                      />
                    </AccordionPanel>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setConfirmCancelOpen(true)}
            >
              Cancelar
            </Button>
            <Button type="button" disabled={saving || loading || entries.length === 0} onClick={handleSaveAll}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmCancelOpen}
        onOpenChange={setConfirmCancelOpen}
        title="Descartar alterações?"
        description="As edições feitas nos items selecionados ainda não foram salvas e serão perdidas."
        confirmLabel="Descartar"
        onConfirm={() => {
          setConfirmCancelOpen(false);
          onOpenChange(false);
        }}
      />

      <ItemConflictDialog
        conflict={conflict}
        cancelLabel="Pular este item"
        onResolve={(decision) => conflict?.resolve(decision)}
      />
    </>
  );
}
