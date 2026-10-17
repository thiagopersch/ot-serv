"use client";

import type { Control, FieldValues, Path } from "react-hook-form";

import { NumberField } from "@/components/shared/number-field";
import { Input } from "@/components/ui/input";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MONSTER_SKULL_OPTIONS, type MonsterFormInput } from "@/lib/validations/admin/monster";

const BOOL_FLAGS: [keyof MonsterFormInput["flags"], string][] = [
  ["summonable", "Pode ser invocado (Summonable)"],
  ["attackable", "Pode ser atacado (Attackable)"],
  ["hostile", "Hostil (Hostile)"],
  ["illusionable", "Pode ser ilusionado (Illusionable)"],
  ["convinceable", "Pode ser convencido (Convinceable)"],
  ["pushable", "Pode ser empurrado (Pushable)"],
  ["canpushitems", "Pode empurrar itens (canpushitems)"],
  ["canpushcreatures", "Pode empurrar criaturas (canpushcreatures)"],
  ["hidename", "Esconder nome (hidename)"],
  ["hidehealth", "Esconder vida (hidehealth)"],
  ["lureable", "Pode ser atraído (Lureable)"],
  ["walkable", "Pode ser atravessado (Walkable)"],
  ["canwalkonenergy", "Anda sobre energia (canwalkonenergy)"],
  ["canwalkonfire", "Anda sobre fogo (canwalkonfire)"],
  ["canwalkonpoison", "Anda sobre veneno (canwalkonpoison)"],
];

const INT_FLAGS: [keyof MonsterFormInput["flags"], string][] = [
  ["lootmessage", "Mensagem de loot (0-3, -1 padrão config) (Loot message)"],
  ["targetdistance", "Distância do alvo (Target distance)"],
  ["staticattack", "Ataque estático (0-100) (Static attack)"],
  ["lightlevel", "Nível de luz (Light level)"],
  ["lightcolor", "Cor da luz (Light color)"],
  ["runonhealth", "Foge com vida abaixo de (Run on health)"],
];

const STRING_FLAGS: [keyof MonsterFormInput["flags"], string][] = [
  ["shield", "Escudo (Shield)"],
  ["emblem", "Emblema (Emblem)"],
];

export function MonsterFlagsFields<T extends FieldValues>({
  control,
}: {
  control: Control<T>;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">Comportamento</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {BOOL_FLAGS.map(([name, label]) => (
            <FormField
              key={name}
              control={control}
              name={`flags.${name}` as Path<T>}
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
                  <FormLabel className="!mt-0 font-normal">{label}</FormLabel>
                </FormItem>
              )}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Parâmetros</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {INT_FLAGS.map(([name, label]) => (
            <NumberField
              key={name}
              control={control}
              name={`flags.${name}` as Path<T>}
              label={label}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Skull / shield / emblem</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            control={control}
            name={"flags.skull" as Path<T>}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Caveira (Skull)</FormLabel>
                <Select value={String(field.value ?? "0")} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {MONSTER_SKULL_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          {STRING_FLAGS.map(([name, label]) => (
            <FormField
              key={name}
              control={control}
              name={`flags.${name}` as Path<T>}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{label}</FormLabel>
                  <FormControl>
                    <Input {...field} value={String(field.value ?? "")} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
