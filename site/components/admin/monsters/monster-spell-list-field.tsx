"use client";

import {
  useFieldArray,
  useController,
  type Control,
  type FieldArrayPath,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { NumberField } from "@/components/shared/number-field";
import { emptyMonsterSpell } from "@/lib/validations/admin/monster";
import { MonsterSpellCombobox } from "@/components/admin/monsters/monster-spell-combobox";

type MonsterSpellListFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: string;
  addLabel: string;
};

export function MonsterSpellListField<T extends FieldValues>({
  control,
  name,
  addLabel,
}: MonsterSpellListFieldProps<T>) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: name as FieldArrayPath<T>,
  });

  return (
    <div className="flex flex-col gap-3">
      {fields.map((field, index) => (
        <SpellCard
          key={field.id}
          control={control}
          basePath={`${name}.${index}`}
          onRemove={() => remove(index)}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => append(emptyMonsterSpell as never)}
      >
        <Plus className="size-4" />
        {addLabel}
      </Button>
    </div>
  );
}

function SpellCard<T extends FieldValues>({
  control,
  basePath,
  onRemove,
}: {
  control: Control<T>;
  basePath: string;
  onRemove: () => void;
}) {
  const attributes = useFieldArray({
    control,
    name: `${basePath}.attributes` as FieldArrayPath<T>,
  });

  const spellIdField = useController({
    control,
    name: `${basePath}.spellId` as FieldPath<T>,
  });
  const nameField = useController({
    control,
    name: `${basePath}.name` as FieldPath<T>,
  });

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-4">
        <FormItem>
          <FormLabel>Spell vinculada (opcional)</FormLabel>
          <MonsterSpellCombobox
            value={
              (spellIdField.field.value as number | null | undefined) ?? null
            }
            onSelect={(spell) => {
              spellIdField.field.onChange(spell?.id ?? null);
              if (spell) nameField.field.onChange(spell.name);
            }}
          />
        </FormItem>
        <div className="grid gap-3 sm:grid-cols-4">
          <FormField
            control={control}
            name={`${basePath}.name` as FieldPath<T>}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome (Name)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={String(field.value ?? "")}
                    placeholder="melee, fire, speed..."
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`${basePath}.script` as FieldPath<T>}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Script (opcional)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={String(field.value ?? "")}
                    placeholder="custom.lua"
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <NumberField
            control={control}
            name={`${basePath}.interval` as FieldPath<T>}
            label="Intervalo (Interval)"
          />
          <NumberField
            control={control}
            name={`${basePath}.chance` as FieldPath<T>}
            label="Chance"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <NumberField
            control={control}
            name={`${basePath}.min` as FieldPath<T>}
            label="Mínimo (Min)"
          />
          <NumberField
            control={control}
            name={`${basePath}.max` as FieldPath<T>}
            label="Máximo (Max)"
          />
          <NumberField
            control={control}
            name={`${basePath}.range` as FieldPath<T>}
            label="Alcance (Range)"
          />
          <NumberField
            control={control}
            name={`${basePath}.radius` as FieldPath<T>}
            label="Raio (Radius)"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <NumberField
            control={control}
            name={`${basePath}.length` as FieldPath<T>}
            label="Comprimento (Length)"
          />
          <NumberField
            control={control}
            name={`${basePath}.spread` as FieldPath<T>}
            label="Espalhamento (Spread)"
          />
          <NumberField
            control={control}
            name={`${basePath}.speedchange` as FieldPath<T>}
            label="Mudança de velocidade (Speedchange)"
          />
          <NumberField
            control={control}
            name={`${basePath}.duration` as FieldPath<T>}
            label="Duração (Duration)"
          />
        </div>

        <FormField
          control={control}
          name={`${basePath}.target` as FieldPath<T>}
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
              <FormLabel className="!mt-0 font-normal">
                Mira o alvo (Target)
              </FormLabel>
            </FormItem>
          )}
        />

        <div>
          <p className="mb-2 text-xs text-muted-foreground">
            Atributos (ex.: shootEffect / areaEffect)
          </p>
          <div className="flex flex-col gap-2">
            {attributes.fields.map((attribute, attrIndex) => (
              <div
                key={attribute.id}
                className="grid grid-cols-[1fr_1fr_auto] items-center gap-2"
              >
                <FormField
                  control={control}
                  name={
                    `${basePath}.attributes.${attrIndex}.key` as FieldPath<T>
                  }
                  render={({ field }) => (
                    <Input
                      {...field}
                      value={String(field.value ?? "")}
                      placeholder="key"
                    />
                  )}
                />
                <FormField
                  control={control}
                  name={
                    `${basePath}.attributes.${attrIndex}.value` as FieldPath<T>
                  }
                  render={({ field }) => (
                    <Input
                      {...field}
                      value={String(field.value ?? "")}
                      placeholder="value"
                    />
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => attributes.remove(attrIndex)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => attributes.append({ key: "", value: "" } as never)}
            >
              <Plus className="size-4" />
              Adicionar atributo
            </Button>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-end text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="size-4" />
          Remover
        </Button>
      </CardContent>
    </Card>
  );
}
