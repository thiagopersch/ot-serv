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
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { NumberField } from "@/components/shared/number-field";
import { EntitySearchCombobox } from "@/components/shared/entity-search-combobox";
import { EntityThumb } from "@/components/shared/entity-thumb";

type NamedRow = { id: number; name: string; clientId?: number | null };

type DailyRewardEntry = {
  itemId: number;
  clientId: number;
  count: number;
  [key: string]: number;
};

type DailyRewardEntryListFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: string;
  /** Nome do campo de dia dentro de cada entrada — "day" pras recompensas normais (1-31),
   * "streakDay" pras bonus (marcos de sequência). Omitido no padrão do mês (`/default`), onde os
   * itens não têm dia — o dia é sorteado na geração. */
  dayField?: string;
  dayLabel?: string;
  dayMax?: number;
  emptyLabel: string;
  addLabel: string;
  /** Limite de cadastros na lista (ex.: 4 pras recompensas bonus) — omitido = sem limite. */
  maxEntries?: number;
};

export function DailyRewardEntryListField<T extends FieldValues>({
  control,
  name,
  dayField,
  dayLabel,
  dayMax,
  emptyLabel,
  addLabel,
  maxEntries,
}: DailyRewardEntryListFieldProps<T>) {
  const { fields, append, insert, remove } = useFieldArray({
    control,
    name: name as FieldArrayPath<T>,
  });
  const values = useWatch({ control, name: name as FieldPath<T> }) as DailyRewardEntry[] | undefined;
  const entries = values ?? [];

  const [editing, setEditing] = useState<{ index: number; isNew: boolean } | null>(null);
  const atLimit = typeof maxEntries === "number" && fields.length >= maxEntries;

  function handleAdd() {
    const index = fields.length;
    append((dayField ? { [dayField]: 1, itemId: 0, clientId: 0, count: 1 } : { itemId: 0, clientId: 0, count: 1 }) as never);
    setEditing({ index, isNew: true });
  }

  function handleCancelNew() {
    if (editing) remove(editing.index);
    setEditing(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={handleAdd} disabled={atLimit}>
          <Plus className="size-4" />
          {addLabel}
        </Button>
        {typeof maxEntries === "number" && (
          <span className="text-xs text-muted-foreground">
            {fields.length}/{maxEntries}
          </span>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {entries
            .map((entry, index) => ({ entry, index }))
            .sort((a, b) => (dayField ? a.entry[dayField] - b.entry[dayField] : 0))
            .map(({ entry, index }) => (
              <EntryCard
                key={index}
                entry={entry}
                dayField={dayField}
                dayLabel={dayLabel}
                onEdit={() => setEditing({ index, isNew: false })}
                onDuplicate={() => insert(index + 1, structuredClone(entry) as never)}
                onRemove={() => remove(index)}
              />
            ))}
        </div>
      )}

      {editing && (
        <Dialog open onOpenChange={(next) => !next && setEditing(null)}>
          <DialogContent className="flex max-h-[90vh] flex-col overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing.isNew ? addLabel : "Editar recompensa"}</DialogTitle>
            </DialogHeader>
            <EntryFields
              control={control}
              basePath={`${name}.${editing.index}`}
              dayField={dayField}
              dayLabel={dayLabel}
              dayMax={dayMax}
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
    </div>
  );
}

function EntryCard({
  entry,
  dayField,
  dayLabel,
  onEdit,
  onDuplicate,
  onRemove,
}: {
  entry: DailyRewardEntry;
  dayField?: string;
  dayLabel?: string;
  onEdit: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="group relative flex flex-col items-center gap-1.5 rounded-md border p-2 text-center">
      <div className="flex w-full items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <Button type="button" variant="ghost" size="icon-sm" title="Editar" onClick={onEdit}>
          <Pencil className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" title="Duplicar" onClick={onDuplicate}>
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
        <EntityThumb entityType="item" id={entry.itemId} size="lg" zoomOnHover={false} />
        {dayField && (
          <p className="text-xs font-medium">
            {dayLabel} {entry[dayField]}
          </p>
        )}
        <p className="text-[11px] text-muted-foreground">×{entry.count}</p>
      </button>
    </div>
  );
}

function EntryFields<T extends FieldValues>({
  control,
  basePath,
  dayField,
  dayLabel,
  dayMax,
}: {
  control: Control<T>;
  basePath: string;
  dayField?: string;
  dayLabel?: string;
  dayMax?: number;
}) {
  const idController = useController({ control, name: `${basePath}.itemId` as FieldPath<T> });
  const clientIdController = useController({ control, name: `${basePath}.clientId` as FieldPath<T> });
  const itemId = idController.field.value as number;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        {dayField && (
          <NumberField
            control={control}
            name={`${basePath}.${dayField}` as FieldPath<T>}
            label={dayLabel}
            tooltip={`Entre 1 e ${dayMax}.`}
          />
        )}
        <NumberField control={control} name={`${basePath}.count` as FieldPath<T>} label="Quantidade" />
      </div>

      <FormItem>
        <FormLabel>Item</FormLabel>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <EntitySearchCombobox<NamedRow>
              endpoint="/api/admin/items"
              value={itemId || null}
              placeholder="Buscar item..."
              formatOption={(item) => `${item.name} (#${item.id})`}
              renderOption={(item) => (
                <span className="flex items-center gap-2">
                  <EntityThumb entityType="item" id={item.id} name={item.name} size="32" />
                  {item.name} (#{item.id})
                </span>
              )}
              onSelect={(item) => {
                idController.field.onChange(item?.id ?? 0);
                if (item?.clientId) clientIdController.field.onChange(item.clientId);
              }}
            />
          </div>
          {itemId > 0 && <EntityThumb entityType="item" id={itemId} size="32" />}
        </div>
        <FormMessage />
      </FormItem>

      <NumberField
        control={control}
        name={`${basePath}.clientId` as FieldPath<T>}
        label="Client ID (sprite no cliente)"
        tooltip="Id do sprite no .dat/.otb do cliente — preenchido automaticamente ao escolher o item (items.client_id). O servidor lê esse valor direto do banco (data/lib/daily_reward.lua), então confira se o item não tem client id cadastrado."
      />
    </div>
  );
}
