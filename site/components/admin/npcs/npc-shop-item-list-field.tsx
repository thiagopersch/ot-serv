"use client";

import { useState } from "react";
import {
  useController,
  useFieldArray,
  useWatch,
  type Control,
  type FieldArrayPath,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { ArrowLeftRight, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { NpcShopDirection, NpcShopItemInput } from "@/lib/validations/admin/npc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Accordion, AccordionItem, AccordionTrigger, AccordionPanel } from "@/components/ui/accordion";
import { FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NumberField } from "@/components/shared/number-field";
import { EntitySearchCombobox } from "@/components/shared/entity-search-combobox";
import { EntityThumb } from "@/components/shared/entity-thumb";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

const SECTIONS: { direction: NpcShopDirection; label: string; badgeClassName: string }[] = [
  { direction: "buy", label: "Compra", badgeClassName: "bg-emerald-500/10" },
  { direction: "sell", label: "Venda", badgeClassName: "bg-amber-500/10" },
];

function oppositeDirection(direction: NpcShopDirection): NpcShopDirection {
  return direction === "buy" ? "sell" : "buy";
}

function directionLabel(direction: NpcShopDirection): string {
  return direction === "buy" ? "Compra" : "Venda";
}

function emptyShopItem(direction: NpcShopDirection): NpcShopItemInput {
  return { direction, itemId: null, name: "", valueCrystal: 0 };
}

function hasDuplicate(
  items: NpcShopItemInput[] | undefined,
  direction: NpcShopDirection,
  itemId: number,
  skipIndex: number,
): boolean {
  return (items ?? []).some(
    (other, otherIndex) => otherIndex !== skipIndex && other.direction === direction && other.itemId === itemId,
  );
}

/** Itens que o NPC compra/vende — separados em 2 seções (accordion), uma por direção, cada uma
 * com sua própria cor de destaque. Mesma ideia visual de card+dialog da tab de Loot dos
 * monstros (`MonsterLootListField`), incluindo o botão de duplicar. */
export function NpcShopItemListField<T extends FieldValues>({
  control,
  name,
}: {
  control: Control<T>;
  name: string;
}) {
  const { fields, append, insert, remove } = useFieldArray({
    control,
    name: name as FieldArrayPath<T>,
  });
  const allItems = useWatch({ control, name: name as FieldPath<T> }) as NpcShopItemInput[] | undefined;
  const [editing, setEditing] = useState<{ index: number; isNew: boolean } | null>(null);
  const [confirmDuplicateSection, setConfirmDuplicateSection] = useState<NpcShopDirection | null>(null);
  const [search, setSearch] = useState<Record<NpcShopDirection, string>>({ buy: "", sell: "" });

  function handleAdd(direction: NpcShopDirection) {
    const index = fields.length;
    append(emptyShopItem(direction) as never);
    setEditing({ index, isNew: true });
  }

  function handleDuplicate(index: number, value: NpcShopItemInput) {
    const newIndex = index + 1;
    insert(newIndex, structuredClone(value) as never);
    setEditing({ index: newIndex, isNew: false });
  }

  function handleCancelNew() {
    if (editing) remove(editing.index);
    setEditing(null);
  }

  function handleDuplicateSection(from: NpcShopDirection) {
    const to = oppositeDirection(from);
    const source = (allItems ?? []).filter(
      (item): item is NpcShopItemInput & { itemId: number } => item.direction === from && item.itemId != null,
    );
    const existingIds = new Set(
      (allItems ?? []).filter((item) => item.direction === to).map((item) => item.itemId),
    );
    const toAdd = source
      .filter((item) => !existingIds.has(item.itemId))
      .map((item) => ({ ...structuredClone(item), direction: to }));

    if (toAdd.length === 0) {
      toast.info("Nenhum item novo para duplicar.");
      return;
    }
    append(toAdd as never);
    toast.success(`${toAdd.length} item(ns) duplicado(s) para ${directionLabel(to)}.`);
  }

  return (
    <div className="flex flex-col gap-3">
      <Accordion multiple defaultValue={[]} className="flex flex-col gap-3">
        {SECTIONS.map((section) => {
          const indexes = (fields ?? [])
            .map((_, index) => index)
            .filter((index) => (allItems?.[index]?.direction ?? null) === section.direction);

          const query = search[section.direction].trim().toLowerCase();
          const filteredIndexes = query
            ? indexes.filter((index) => {
                const item = allItems?.[index];
                if (!item) return false;
                return (
                  item.name?.toLowerCase().includes(query) ||
                  String(item.itemId ?? "").includes(query)
                );
              })
            : indexes;

          return (
            <AccordionItem key={section.direction} value={section.direction} className={section.badgeClassName}>
              <AccordionTrigger>
                <span>
                  {section.label} ({indexes.length})
                </span>
              </AccordionTrigger>
              <AccordionPanel>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleAdd(section.direction)}
                  >
                    <Plus className="size-4" />
                    Adicionar item
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={indexes.length === 0}
                    onClick={() => setConfirmDuplicateSection(section.direction)}
                  >
                    <Copy className="size-4" />
                    Duplicar tudo para {directionLabel(oppositeDirection(section.direction))}
                  </Button>
                </div>

                {indexes.length > 0 && (
                  <Input
                    value={search[section.direction]}
                    onChange={(event) =>
                      setSearch((prev) => ({ ...prev, [section.direction]: event.target.value }))
                    }
                    placeholder="Buscar por nome ou id..."
                    className="max-w-xs"
                  />
                )}

                {indexes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum item ainda.</p>
                ) : filteredIndexes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum item encontrado.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                    {filteredIndexes.map((index) => (
                      <ShopItemCard
                        key={fields[index]?.id ?? index}
                        control={control}
                        name={name}
                        index={index}
                        basePath={`${name}.${index}`}
                        onEdit={() => setEditing({ index, isNew: false })}
                        onDuplicate={(value) => handleDuplicate(index, value)}
                        onRemove={() => remove(index)}
                      />
                    ))}
                  </div>
                )}
              </AccordionPanel>
            </AccordionItem>
          );
        })}
      </Accordion>

      {editing && (
        <Dialog open onOpenChange={(next) => !next && setEditing(null)}>
          <DialogContent className="flex max-h-[90vh] flex-col overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing.isNew ? "Adicionar item" : "Editar item"}</DialogTitle>
            </DialogHeader>
            <ShopItemFields
              control={control}
              name={name}
              basePath={`${name}.${editing.index}`}
              index={editing.index}
              canMove={!editing.isNew}
            />
            <DialogFooter className="sm:justify-between">
              {editing.isNew ? (
                <Button type="button" variant="outline" onClick={handleCancelNew}>
                  Cancelar
                </Button>
              ) : (
                <span />
              )}
              <Button type="button" onClick={() => setEditing(null)}>
                Concluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <ConfirmDialog
        open={confirmDuplicateSection !== null}
        onOpenChange={(next) => !next && setConfirmDuplicateSection(null)}
        title="Duplicar todos os itens"
        description={
          confirmDuplicateSection
            ? `Todos os itens de ${directionLabel(confirmDuplicateSection)} serão duplicados para ${directionLabel(oppositeDirection(confirmDuplicateSection))}. Itens já cadastrados no destino serão mantidos como estão e não serão duplicados.`
            : ""
        }
        confirmLabel="Duplicar"
        onConfirm={() => {
          if (confirmDuplicateSection) handleDuplicateSection(confirmDuplicateSection);
          setConfirmDuplicateSection(null);
        }}
      />
    </div>
  );
}

function ShopItemCard<T extends FieldValues>({
  control,
  name,
  index,
  basePath,
  onEdit,
  onDuplicate,
  onRemove,
}: {
  control: Control<T>;
  name: string;
  index: number;
  basePath: string;
  onEdit: () => void;
  onDuplicate: (value: NpcShopItemInput) => void;
  onRemove: () => void;
}) {
  const value = useWatch({ control, name: basePath as FieldPath<T> }) as NpcShopItemInput;
  const directionController = useController({ control, name: `${basePath}.direction` as FieldPath<T> });
  const allItems = useWatch({ control, name: name as FieldPath<T> }) as NpcShopItemInput[] | undefined;

  function handleToggleDirection() {
    const next = oppositeDirection(value.direction as NpcShopDirection);
    if (value.itemId && hasDuplicate(allItems, next, value.itemId, index)) {
      toast.error(`"${value.name || `Item #${value.itemId}`}" já está cadastrado em ${directionLabel(next)}.`);
      return;
    }
    directionController.field.onChange(next);
  }

  return (
    <div className="group relative flex flex-col items-center gap-1.5 rounded-md border bg-background p-2 text-center">
      <div className="flex w-full items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title={value.direction === "buy" ? "Mover para Venda" : "Mover para Compra"}
          onClick={handleToggleDirection}
        >
          <ArrowLeftRight className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" title="Editar" onClick={onEdit}>
          <Pencil className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" title="Duplicar" onClick={() => onDuplicate(value)}>
          <Copy className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Remover"
          className="text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <button type="button" onClick={onEdit} className="flex flex-col items-center gap-1.5">
        <EntityThumb entityType="item" id={value.itemId ?? 0} name={value.name} size="lg" zoomOnHover={false} />
        <p className="line-clamp-1 text-xs font-medium">
          {value.itemId ? `${value.name || "Sem nome"} (#${value.itemId})` : "Sem item"}
        </p>
        <p className="text-[11px] text-muted-foreground">{value.valueCrystal} crystal</p>
      </button>
    </div>
  );
}

function ShopItemFields<T extends FieldValues>({
  control,
  name,
  basePath,
  index,
  canMove,
}: {
  control: Control<T>;
  name: string;
  basePath: string;
  index: number;
  canMove: boolean;
}) {
  const directionController = useController({ control, name: `${basePath}.direction` as FieldPath<T> });
  const idController = useController({ control, name: `${basePath}.itemId` as FieldPath<T> });
  const nameController = useController({ control, name: `${basePath}.name` as FieldPath<T> });
  const itemId = idController.field.value as number | null | undefined;
  const itemName = nameController.field.value as string | undefined;
  const direction = directionController.field.value as NpcShopDirection | null;
  const allItems = useWatch({ control, name: name as FieldPath<T> }) as NpcShopItemInput[] | undefined;

  function handleSelectItem(item: { id: number; name: string } | null) {
    if (item && direction && hasDuplicate(allItems, direction, item.id, index)) {
      toast.error(`"${item.name}" já está cadastrado em ${directionLabel(direction)}.`);
      return;
    }
    idController.field.onChange(item?.id ?? null);
    nameController.field.onChange(item?.name ?? "");
  }

  function handleMoveDirection() {
    if (!direction) return;
    const next = oppositeDirection(direction);
    if (itemId && hasDuplicate(allItems, next, itemId, index)) {
      toast.error(`"${itemName || `Item #${itemId}`}" já está cadastrado em ${directionLabel(next)}.`);
      return;
    }
    directionController.field.onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      {canMove && direction && (
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={handleMoveDirection}>
          <ArrowLeftRight className="size-4" />
          Mover para {directionLabel(oppositeDirection(direction))}
        </Button>
      )}

      <FormItem>
        <FormLabel>Item</FormLabel>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <EntitySearchCombobox<{ id: number; name: string }>
              endpoint="/api/admin/items"
              value={itemId || null}
              placeholder="Buscar item por nome ou id..."
              formatOption={(item) => `${item.name} (#${item.id})`}
              renderOption={(item) => (
                <span className="flex items-center gap-2">
                  <EntityThumb entityType="item" id={item.id} name={item.name} size="32" />
                  {item.name} (#{item.id})
                </span>
              )}
              onSelect={handleSelectItem}
            />
          </div>
          {Boolean(itemId) && <EntityThumb entityType="item" id={itemId as number} size="32" />}
        </div>
      </FormItem>

      <NumberField control={control} name={`${basePath}.valueCrystal` as FieldPath<T>} label="Valor (crystal coin)" />
    </div>
  );
}
