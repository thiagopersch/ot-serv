"use client";

import { useEffect, useState } from "react";
import {
  useController,
  useFieldArray,
  useFormContext,
  useWatch,
  type Control,
  type FieldArrayPath,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { ChevronDown, Copy, Pencil, Plus, Trash2 } from "lucide-react";

import type { MonsterLootItemInput } from "@/lib/validations/admin/monster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Collapsible, CollapsibleTrigger, CollapsiblePanel } from "@/components/ui/collapsible";
import { NumberField } from "@/components/shared/number-field";
import { EntitySearchCombobox } from "@/components/shared/entity-search-combobox";
import { EntityThumb } from "@/components/shared/entity-thumb";
import { useItemName } from "@/components/shared/use-item-name";
import { emptyMonsterLootItem } from "@/lib/validations/admin/monster";

export function MonsterLootListField<T extends FieldValues>({
  control,
  name,
  nested = false,
}: {
  control: Control<T>;
  name: string;
  /** Quando `true`, renderiza o editor de item inline (sem `Dialog`) — usado para o conteúdo de
   * containers, evitando empilhar um segundo Dialog/overlay em cima do dialog pai (isso deixava
   * botões de itens filhos inalcançáveis, atrás do overlay errado). */
  nested?: boolean;
}) {
  const { fields, append, insert, remove } = useFieldArray({
    control,
    name: name as FieldArrayPath<T>,
  });
  const { getValues, setValue } = useFormContext<T>();
  const [editing, setEditing] = useState<{ index: number; isNew: boolean; snapshot: MonsterLootItemInput } | null>(
    null,
  );

  function openEdit(index: number, isNew: boolean) {
    const snapshot = structuredClone(getValues(`${name}.${index}` as FieldPath<T>)) as MonsterLootItemInput;
    setEditing({ index, isNew, snapshot });
  }

  function handleAdd() {
    const index = fields.length;
    append(emptyMonsterLootItem as never);
    openEdit(index, true);
  }

  /** Fecha o editor descartando qualquer alteração feita — usado tanto pelo botão "Cancelar"
   * quanto ao fechar via X/clique fora, pra nenhum dos dois salvar mudanças silenciosamente. */
  function discardEdit() {
    if (!editing) return;
    if (editing.isNew) {
      remove(editing.index);
    } else {
      setValue(`${name}.${editing.index}` as FieldPath<T>, editing.snapshot as never, { shouldDirty: false });
    }
    setEditing(null);
  }

  function confirmEdit() {
    setEditing(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={handleAdd}>
        <Plus className="size-4" />
        Adicionar item
      </Button>

      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum item de loot ainda.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {fields.map((field, index) => (
            <LootItemCard
              key={field.id}
              control={control}
              basePath={`${name}.${index}`}
              onEdit={() => openEdit(index, false)}
              onDuplicate={(value) => insert(index + 1, structuredClone(value) as never)}
              onRemove={() => remove(index)}
            />
          ))}
        </div>
      )}

      {editing && nested && (
        <div className="flex flex-col gap-4 rounded-md border p-3">
          <p className="text-sm font-medium">{editing.isNew ? "Adicionar item de loot" : "Editar item de loot"}</p>
          <LootItemFields control={control} basePath={`${name}.${editing.index}`} />
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="outline" onClick={discardEdit}>
              Cancelar
            </Button>
            <Button type="button" onClick={confirmEdit}>
              Concluir
            </Button>
          </div>
        </div>
      )}

      {editing && !nested && (
        <Dialog open onOpenChange={(next) => !next && discardEdit()}>
          <DialogContent className="flex max-h-[90vh] flex-col overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing.isNew ? "Adicionar item de loot" : "Editar item de loot"}</DialogTitle>
            </DialogHeader>
            <LootItemFields control={control} basePath={`${name}.${editing.index}`} />
            <DialogFooter className="sm:justify-between">
              <Button type="button" variant="outline" onClick={discardEdit}>
                Cancelar
              </Button>
              <Button type="button" onClick={confirmEdit}>
                Concluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function LootItemCard<T extends FieldValues>({
  control,
  basePath,
  onEdit,
  onDuplicate,
  onRemove,
}: {
  control: Control<T>;
  basePath: string;
  onEdit: () => void;
  onDuplicate: (value: MonsterLootItemInput) => void;
  onRemove: () => void;
}) {
  const value = useWatch({ control, name: basePath as FieldPath<T> }) as MonsterLootItemInput;

  return (
    <div className="group relative flex flex-col items-center gap-1.5 rounded-md border p-2 text-center">
      <div className="flex w-full items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
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
        <EntityThumb entityType="item" id={value.id} name={value.comment} size="lg" zoomOnHover={false} />
        <p className="line-clamp-1 text-xs font-medium">{value.comment || (value.id > 0 ? `Item #${value.id}` : "Sem item")}</p>
        <p className="text-[11px] text-muted-foreground">
          ×{value.count} · {value.chance}%
        </p>
      </button>

      {(value.children ?? []).length > 0 && (
        <div className="flex flex-wrap justify-center gap-1 border-t pt-1.5">
          {(value.children ?? []).map((child, index) => (
            <EntityThumb key={index} entityType="item" id={child.id} name={child.comment} size="32" />
          ))}
        </div>
      )}
    </div>
  );
}

function LootItemFields<T extends FieldValues>({
  control,
  basePath,
}: {
  control: Control<T>;
  basePath: string;
}) {
  const idController = useController({
    control,
    name: `${basePath}.id` as FieldPath<T>,
  });
  const commentController = useController({
    control,
    name: `${basePath}.comment` as FieldPath<T>,
  });
  const itemId = idController.field.value as number | null | undefined;
  const itemName = useItemName(itemId);

  useEffect(() => {
    if (itemName) commentController.field.onChange(itemName);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage à mudança do item, não do comentário
  }, [itemName]);

  return (
    <div className="flex flex-col gap-4">
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
              onSelect={(item) => idController.field.onChange(item?.id ?? 0)}
            />
          </div>
          {Boolean(itemId) && <EntityThumb entityType="item" id={itemId as number} size="32" />}
        </div>
      </FormItem>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <NumberField
          control={control}
          name={`${basePath}.count` as FieldPath<T>}
          label="Quantidade máxima (Count max)"
        />
        <NumberField
          control={control}
          name={`${basePath}.chance` as FieldPath<T>}
          label="Chance (%)"
          step="0.001"
        />
        <FormField
          control={control}
          name={`${basePath}.comment` as FieldPath<T>}
          render={({ field }) => (
            <FormItem className="col-span-2 sm:col-span-1">
              <FormLabel>Comentário</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={String(field.value ?? "")}
                  placeholder="nome do item"
                />
              </FormControl>
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <NumberField
          control={control}
          name={`${basePath}.subtype` as FieldPath<T>}
          label="Subtipo (Subtype)"
          nullable
        />
        <NumberField
          control={control}
          name={`${basePath}.actionId` as FieldPath<T>}
          label="Action ID"
          nullable
        />
        <NumberField
          control={control}
          name={`${basePath}.uniqueId` as FieldPath<T>}
          label="Unique ID"
          nullable
        />
      </div>

      <FormField
        control={control}
        name={`${basePath}.text` as FieldPath<T>}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Texto (Text)</FormLabel>
            <FormControl>
              <Input {...field} value={String(field.value ?? "")} />
            </FormControl>
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name={`${basePath}.addToAutoloot` as FieldPath<T>}
        render={({ field }) => (
          <FormItem className="flex flex-row items-center gap-2">
            <FormControl>
              <input
                type="checkbox"
                className="size-4"
                checked={Boolean(field.value)}
                onChange={(event) => field.onChange(event.target.checked)}
              />
            </FormControl>
            <FormLabel className="!mt-0">
              Adicionar ao autoloot (disponível no módulo de autoloot do OTC)
            </FormLabel>
          </FormItem>
        )}
      />

      <div className="rounded-md border border-dashed p-3">
        <Collapsible defaultOpen>
          <CollapsibleTrigger>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 data-panel-open:rotate-180" />
            <span className="text-xs font-medium text-muted-foreground">
              Conteúdo{itemName ? ` — ${itemName}` : " (se for um container)"}
            </span>
          </CollapsibleTrigger>
          <CollapsiblePanel>
            <MonsterLootListField control={control} name={`${basePath}.children`} nested />
          </CollapsiblePanel>
        </Collapsible>
      </div>
    </div>
  );
}
