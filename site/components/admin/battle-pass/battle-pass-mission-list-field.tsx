"use client";

import { useState } from "react";
import {
  useFieldArray,
  useFormContext,
  useWatch,
  type Control,
  type FieldArrayPath,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";

import {
  BATTLE_PASS_MISSION_TYPES,
  BATTLE_PASS_MISSION_TYPE_LABELS,
  BATTLE_PASS_MISSION_AMOUNT_LABELS,
  type BattlePassMissionInput,
  type BattlePassMissionType,
} from "@/lib/validations/admin/battle-pass";
import { VOCATION_RANKS, VOCATION_RANK_LABELS, VOCATION_RANK_COLORS } from "@/lib/vocation-rank";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NumberField } from "@/components/shared/number-field";
import { FormattedNumberField } from "@/components/shared/formatted-number-field";
import { EntitySearchCombobox } from "@/components/shared/entity-search-combobox";
import { MonsterThumb } from "@/components/shared/monster-thumb";
import { MonsterThumbByName } from "@/components/admin/tasks/monster-thumb-by-name";

type MonsterRow = { id: number; name: string; lookTypeId: number | null };

const VOCATION_RANKS_WITHOUT_NONE = VOCATION_RANKS.filter((rank) => rank > 0);

const emptyMission: BattlePassMissionInput = {
  type: "kill_monster",
  target: {},
  description: "",
  xpReward: 0,
  published: true,
};

export function BattlePassMissionListField<T extends FieldValues>({
  control,
  name,
}: {
  control: Control<T>;
  name: string;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: name as FieldArrayPath<T>,
  });
  const [editing, setEditing] = useState<{ index: number; isNew: boolean } | null>(null);

  function handleAdd() {
    const index = fields.length;
    append(emptyMission as never);
    setEditing({ index, isNew: true });
  }

  function handleCancelNew() {
    if (editing) remove(editing.index);
    setEditing(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Missões</span>
        <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
          <Plus className="size-4" />
          Adicionar
        </Button>
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma missão adicionada.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {fields.map((field, index) => (
            <MissionCard
              key={field.id}
              control={control}
              basePath={`${name}.${index}`}
              onEdit={() => setEditing({ index, isNew: false })}
              onDuplicate={(value) => append(structuredClone(value) as never)}
              onRemove={() => remove(index)}
            />
          ))}
        </div>
      )}

      {editing && (
        <Dialog open onOpenChange={(next) => !next && setEditing(null)}>
          <DialogContent className="flex max-h-[90vh] flex-col overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing.isNew ? "Adicionar missão" : "Editar missão"}</DialogTitle>
            </DialogHeader>
            <MissionFields control={control} basePath={`${name}.${editing.index}`} />
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

function MissionCard<T extends FieldValues>({
  control,
  basePath,
  onEdit,
  onDuplicate,
  onRemove,
}: {
  control: Control<T>;
  basePath: string;
  onEdit: () => void;
  onDuplicate: (value: BattlePassMissionInput) => void;
  onRemove: () => void;
}) {
  const value = useWatch({ control, name: basePath as FieldPath<T> }) as BattlePassMissionInput;

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
        {value.type === "kill_monster" && value.target.monster ? (
          <MonsterThumbByName name={value.target.monster} />
        ) : (
          <Badge variant="outline" className="text-[10px]">
            {BATTLE_PASS_MISSION_TYPE_LABELS[value.type]}
          </Badge>
        )}
        <p className="line-clamp-2 text-xs font-medium">{value.description || "Sem descrição"}</p>
        <p className="text-[11px] text-muted-foreground">+{value.xpReward} XP</p>
      </button>
    </div>
  );
}

function MissionFields<T extends FieldValues>({
  control,
  basePath,
}: {
  control: Control<T>;
  basePath: string;
}) {
  const type = useWatch({ control, name: `${basePath}.type` as FieldPath<T> }) as BattlePassMissionType;
  const { setValue } = useFormContext();

  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-2 sm:grid-cols-3">
        <FormField
          control={control}
          name={`${basePath}.type` as FieldPath<T>}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo</FormLabel>
              <Select
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value);
                  setValue(`${basePath}.target`, {});
                }}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {BATTLE_PASS_MISSION_TYPES.map((missionType) => (
                    <SelectItem key={missionType} value={missionType}>
                      {BATTLE_PASS_MISSION_TYPE_LABELS[missionType]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`${basePath}.description` as FieldPath<T>}
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Descrição</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {type === "kill_monster" && (
          <FormField
            control={control}
            name={`${basePath}.target.monster` as FieldPath<T>}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Monstro</FormLabel>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <EntitySearchCombobox<MonsterRow>
                      endpoint="/api/admin/monsters"
                      value={null}
                      placeholder={field.value || "Buscar monstro..."}
                      formatOption={(monster) => monster.name}
                      renderOption={(monster) => (
                        <span className="flex items-center gap-2">
                          <MonsterThumb
                            id={monster.id}
                            name={monster.name}
                            lookTypeId={monster.lookTypeId}
                            size="32"
                          />
                          {monster.name}
                        </span>
                      )}
                      onSelect={(monster) => field.onChange(monster?.name ?? "")}
                    />
                  </div>
                  {field.value && <MonsterThumbByName name={field.value} />}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {type === "dungeon_specific_vocation" && (
          <FormField
            control={control}
            name={`${basePath}.target.vocationId` as FieldPath<T>}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vocação</FormLabel>
                <EntitySearchCombobox<{ id: number; name: string }>
                  endpoint="/api/admin/vocations"
                  value={field.value ?? null}
                  placeholder="Buscar vocação..."
                  formatOption={(vocation) => vocation.name}
                  onSelect={(vocation) => field.onChange(vocation?.id ?? undefined)}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {type === "vocation_rank" ? (
          <FormField
            control={control}
            name={`${basePath}.target.rank` as FieldPath<T>}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rank</FormLabel>
                <Select
                  value={field.value ? String(field.value) : undefined}
                  onValueChange={(value) => field.onChange(Number(value))}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o rank" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {VOCATION_RANKS_WITHOUT_NONE.map((rank) => (
                      <SelectItem key={rank} value={String(rank)}>
                        <span className="flex items-center gap-2">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: VOCATION_RANK_COLORS[rank] }}
                          />
                          {VOCATION_RANK_LABELS[rank]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <NumberField
            control={control}
            name={`${basePath}.target.amount` as FieldPath<T>}
            label={BATTLE_PASS_MISSION_AMOUNT_LABELS[type] || "Quantidade"}
            tooltip={
              type === "kill_monster"
                ? "Quantidade de monstros que precisam ser mortos para completar essa missão."
                : undefined
            }
          />
        )}

        <FormattedNumberField
          control={control}
          name={`${basePath}.xpReward` as FieldPath<T>}
          label="XP"
          tooltip="Quantidade de XP do passe concedida ao completar essa missão."
        />
      </div>
    </div>
  );
}
