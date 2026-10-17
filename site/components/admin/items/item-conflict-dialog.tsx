"use client";

import { useState } from "react";
import useSWR from "swr";
import { ImageOff } from "lucide-react";

import type { Looktype } from "@/lib/generated/prisma/client";
import type { ItemInput } from "@/lib/validations/admin/item";
import {
  ITEM_COMPARE_COLUMNS,
  formatCompareValue,
  getItemDiffPaths,
  getValueAtPath,
} from "@/lib/item-compare";
import { fetcher } from "@/lib/fetcher";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EntityThumb } from "@/components/shared/entity-thumb";
import { LooktypeAnimatedImage } from "@/components/shared/looktype-animated-image";

/** Sprite do cadastro novo que ainda não está no banco: imagem custom pendente de upload ou a
 * looktype já carregada em memória pelo form (evita refazer a busca). */
export type ItemConflictSprite = {
  looktype?: Looktype | null;
  imagePreviewUrl?: string | null;
};

export type ItemConflict = {
  existing: ItemInput;
  incoming: ItemInput;
  incomingSprite?: ItemConflictSprite;
  /** Quantos conflitos ainda aguardam decisão depois deste — > 0 mostra o "aplicar aos restantes". */
  remaining?: number;
};

export type ItemConflictDecision = "replace" | "skip";

type ItemConflictDialogProps = {
  /** null = fechado. */
  conflict: ItemConflict | null;
  /** "Cancelar" na criação single (volta pro form), "Pular este item" no range/edição em massa. */
  cancelLabel: string;
  onResolve: (decision: ItemConflictDecision, applyToRemaining: boolean) => void;
};

const SPRITE_PATH = "lookTypeId";
const MAX_DIFF_NAMES = 8;

/** Colunas agrupadas pro cabeçalho de dois níveis (grupo → campos), mantendo a ordem. */
const COLUMN_GROUPS = ITEM_COMPARE_COLUMNS.reduce<{ group: string; span: number }[]>((groups, column) => {
  const last = groups[groups.length - 1];
  if (last?.group === column.group) last.span += 1;
  else groups.push({ group: column.group, span: 1 });
  return groups;
}, []);

/** Pergunta se um item já cadastrado deve ser substituído pelo que está sendo criado com o
 * mesmo id, mostrando abaixo da mensagem a configuração completa dos dois lado a lado: uma
 * coluna por campo, linha "Existente" e logo abaixo a linha "Novo", com as divergências
 * destacadas. Fechar pelo X/Esc equivale a não substituir. */
export function ItemConflictDialog({ conflict, cancelLabel, onResolve }: ItemConflictDialogProps) {
  const [applyToRemaining, setApplyToRemaining] = useState(false);
  // Mantém o último conflito renderizado durante a animação de fechar, e reseta o checkbox a
  // cada novo conflito (ajuste durante o render, sem efeito).
  const [lastConflict, setLastConflict] = useState(conflict);
  if (conflict && conflict !== lastConflict) {
    setLastConflict(conflict);
    setApplyToRemaining(false);
  }
  const current = conflict ?? lastConflict;

  const diffPaths = current ? getItemDiffPaths(current.existing, current.incoming) : new Set<string>();
  if (current?.incomingSprite?.imagePreviewUrl) diffPaths.add(SPRITE_PATH);
  const diffLabels = ITEM_COMPARE_COLUMNS.filter(({ path }) => diffPaths.has(path)).map(
    ({ label }) => label,
  );
  const remaining = current?.remaining ?? 0;

  return (
    <Dialog
      open={conflict != null}
      disablePointerDismissal
      onOpenChange={(next) => {
        if (!next && conflict) onResolve("skip", false);
      }}
    >
      <DialogContent className="flex max-h-[90vh] w-[90vw] flex-col gap-4 sm:max-w-none">
        {current && (
          <>
            <DialogHeader>
              <DialogTitle>Já existe um item #{current.existing.id}</DialogTitle>
              <DialogDescription>
                O item #{current.existing.id} já está cadastrado com uma configuração diferente (
                {diffLabels.length} {diffLabels.length === 1 ? "campo divergente" : "campos divergentes"}
                ). Deseja substituir o cadastro existente pelo novo?
              </DialogDescription>
              {diffLabels.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Divergências: {diffLabels.slice(0, MAX_DIFF_NAMES).join(", ")}
                  {diffLabels.length > MAX_DIFF_NAMES && ` e mais ${diffLabels.length - MAX_DIFF_NAMES}`}.
                </p>
              )}
            </DialogHeader>

            <div className="min-h-0 overflow-y-auto rounded-md border border-border">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="sticky left-0 z-20 bg-popover" />
                    {COLUMN_GROUPS.map(({ group, span }) => (
                      <TableHead
                        key={group}
                        colSpan={span}
                        className="h-8 border-l border-border text-center text-muted-foreground"
                      >
                        {group}
                      </TableHead>
                    ))}
                  </TableRow>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="sticky left-0 z-20 bg-popover">Cadastro</TableHead>
                    {ITEM_COMPARE_COLUMNS.map(({ path, label }) => (
                      <TableHead
                        key={path}
                        className={cn(
                          "border-l border-border",
                          diffPaths.has(path) && "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
                        )}
                      >
                        {label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <CompareRow label="Existente" item={current.existing} diffPaths={diffPaths} existing />
                  <CompareRow
                    label="Novo"
                    item={current.incoming}
                    diffPaths={diffPaths}
                    sprite={current.incomingSprite}
                  />
                </TableBody>
              </Table>
            </div>

            <DialogFooter className="items-center sm:justify-between">
              {remaining > 0 ? (
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 cursor-pointer"
                    checked={applyToRemaining}
                    onChange={(event) => setApplyToRemaining(event.target.checked)}
                  />
                  Aplicar esta decisão aos {remaining}{" "}
                  {remaining === 1 ? "item restante" : "itens restantes"}
                </label>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onResolve("skip", applyToRemaining)}
                >
                  {cancelLabel}
                </Button>
                <Button type="button" onClick={() => onResolve("replace", applyToRemaining)}>
                  Substituir
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CompareRow({
  label,
  item,
  diffPaths,
  existing = false,
  sprite,
}: {
  label: string;
  item: ItemInput;
  diffPaths: Set<string>;
  existing?: boolean;
  sprite?: ItemConflictSprite;
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableHead scope="row" className="sticky left-0 z-10 bg-popover">
        {label}
      </TableHead>
      {ITEM_COMPARE_COLUMNS.map(({ path }) => {
        const value = getValueAtPath(item, path);
        const text = formatCompareValue(path, value);
        return (
          <TableCell
            key={path}
            className={cn(
              "max-w-64 truncate border-l border-border",
              diffPaths.has(path) && (existing ? "bg-yellow-500/5" : "bg-yellow-500/15 font-medium"),
            )}
            title={path === SPRITE_PATH ? undefined : text}
          >
            {path === SPRITE_PATH ? (
              existing ? (
                <span className="flex items-center gap-2">
                  <EntityThumb entityType="item" id={item.id} name={item.name} size="32" />
                  {text !== "—" && <span className="text-muted-foreground">#{text}</span>}
                </span>
              ) : (
                <IncomingSprite lookTypeId={item.lookTypeId} sprite={sprite} />
              )
            ) : (
              text
            )}
          </TableCell>
        );
      })}
    </TableRow>
  );
}

function IncomingSprite({
  lookTypeId,
  sprite,
}: {
  lookTypeId: number | null;
  sprite?: ItemConflictSprite;
}) {
  const known = sprite?.looktype && sprite.looktype.id === lookTypeId ? sprite.looktype : null;
  const { data } = useSWR<{ data?: Looktype[] }>(
    lookTypeId != null && !known && !sprite?.imagePreviewUrl
      ? `/api/admin/looktypes?id=${lookTypeId}`
      : null,
    fetcher,
  );
  const looktype = known ?? data?.data?.[0] ?? null;

  if (sprite?.imagePreviewUrl) {
    return (
      <span className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- preview local do arquivo selecionado, ainda não enviado */}
        <img
          src={sprite.imagePreviewUrl}
          alt="Nova imagem"
          className="size-8 shrink-0 rounded-sm border border-border object-contain bg-muted/40"
        />
        <span className="text-muted-foreground">nova imagem</span>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2">
      {looktype ? (
        <LooktypeAnimatedImage
          key={looktype.id}
          looktypeId={looktype.id}
          frameCount={looktype.frameCount}
          frameDurationsMs={looktype.frameDurationsMs as number[]}
          updatedAt={looktype.updatedAt}
          size="sm"
        />
      ) : (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-dashed border-border text-muted-foreground">
          <ImageOff className="size-3.5" />
        </span>
      )}
      {lookTypeId != null && <span className="text-muted-foreground">#{lookTypeId}</span>}
    </span>
  );
}
