"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { useWatch } from "react-hook-form";

import { NPC_DEFAULT_MESSAGE_KEYS, type NpcDefaultMessagesInput } from "@/lib/validations/admin/npc";
import { Input } from "@/components/ui/input";
import { FormItem, FormLabel } from "@/components/ui/form";
import { FieldTooltip } from "@/components/shared/field-tooltip";

/** Mensagens padrão nativas do XML (`message_greet`, `message_farewell`, ...) — mostradas
 * sempre, independente do Tipo do NPC (mensagens de categoria "shop" só têm efeito quando o
 * tipo é Loja, mas ficam editáveis aqui mesmo assim, já preenchidas se o NPC mudar de tipo). */
export function NpcDefaultMessageFields<T extends FieldValues>({
  control,
  name,
  onChange,
}: {
  control: Control<T>;
  name: string;
  onChange: (key: string, value: string) => void;
}) {
  const values = (useWatch({ control, name: name as FieldPath<T> }) ?? {}) as NpcDefaultMessagesInput;

  const general = NPC_DEFAULT_MESSAGE_KEYS.filter((entry) => entry.category === "general");
  const shop = NPC_DEFAULT_MESSAGE_KEYS.filter((entry) => entry.category === "shop");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-sm font-medium">Mensagens gerais</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {general.map((entry) => (
            <FormItem key={entry.key}>
              <FormLabel className="flex items-center gap-1.5">
                {entry.label}
                <FieldTooltip text={entry.description} />
              </FormLabel>
              <Input
                value={values[entry.key] ?? ""}
                onChange={(event) => onChange(entry.key, event.target.value)}
                placeholder={entry.key === "message_greet" ? "Hello, |PLAYERNAME|!" : entry.key === "message_farewell" ? "Farewell!" : ""}
              />
            </FormItem>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Mensagens de loja (só têm efeito quando o Tipo é Loja)</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {shop.map((entry) => (
            <FormItem key={entry.key}>
              <FormLabel className="flex items-center gap-1.5">
                {entry.label}
                <FieldTooltip text={entry.description} />
              </FormLabel>
              <Input value={values[entry.key] ?? ""} onChange={(event) => onChange(entry.key, event.target.value)} />
            </FormItem>
          ))}
        </div>
      </div>
    </div>
  );
}
