"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  MOVEMENT_ACTION_KINDS,
  MOVEMENT_EVENT_TYPES,
  MOVEMENT_FUNCTION_NAMES,
  MOVEMENT_SELECTOR_TYPES,
  MOVEMENT_SLOTS,
  defaultMovementValues,
  emptyMovementIdRange,
  movementSchema,
  type MovementInput,
} from "@/lib/validations/admin/movement";
import type { ItemInput } from "@/lib/validations/admin/item";
import { movementToXml } from "@/lib/movement-xml";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NumberField } from "@/components/shared/number-field";
import { EntitySearchCombobox } from "@/components/shared/entity-search-combobox";
import { EntityThumb } from "@/components/shared/entity-thumb";
import { XmlPreviewCard } from "@/components/shared/xml-preview-card";
import { EntitySpritePreview, type SpritePreviewEntry } from "@/components/shared/entity-sprite-preview";
import { MovementVocationField } from "@/components/admin/movements/movement-vocation-field";

type MovementFormProps = {
  movementId?: number;
  initialValues?: MovementInput;
};

function EnumSelect<T extends string>({
  value,
  onChange,
  options,
  placeholder = "—",
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly T[];
  placeholder?: string;
}) {
  return (
    <Select
      value={value || "__empty"}
      onValueChange={(next) => onChange((next === "__empty" ? "" : next) as T)}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option || "__empty"} value={option || "__empty"}>
            {option || "(nenhum)"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function MovementForm({ movementId, initialValues }: MovementFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = movementId != null;

  const form = useForm<MovementInput, unknown, MovementInput>({
    resolver: zodResolver(movementSchema),
    defaultValues: initialValues ?? defaultMovementValues,
  });

  const ranges = useFieldArray({ control: form.control, name: "ranges" });

  const watched = useWatch({ control: form.control });
  const previewXml = movementToXml({
    ...defaultMovementValues,
    ...watched,
  } as MovementInput);

  const selectorType = form.watch("selectorType");
  const eventType = form.watch("eventType");
  const actionKind = form.watch("actionKind");
  const isEquipEvent = eventType === "Equip" || eventType === "DeEquip";

  const spritePreviewItems: SpritePreviewEntry[] =
    selectorType === "ITEM_ID"
      ? [
          ...(watched.itemId != null ? [{ id: watched.itemId, label: "Item" }] : []),
          ...(watched.itemIdRangeEnd != null ? [{ id: watched.itemIdRangeEnd, label: "Até" }] : []),
        ]
      : selectorType === "ITEM_RANGE"
        ? (watched.ranges ?? []).flatMap((range, index) => [
            ...(range?.from != null ? [{ id: range.from, label: `#${index + 1} de` }] : []),
            ...(range?.to != null ? [{ id: range.to, label: `#${index + 1} até` }] : []),
          ])
        : [];

  async function onSubmit(values: MovementInput) {
    setIsSubmitting(true);

    const url = isEditing
      ? `/api/admin/movements/${movementId}`
      : "/api/admin/movements";
    const method = isEditing ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      toast.error(data?.error ?? "Não foi possível salvar o movement.");
      return;
    }

    toast.success(isEditing ? "Movement atualizado." : "Movement criado.");
    router.push("/admin/movements");
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-6"
        >
          <Card>
            <CardHeader>
              <CardTitle>Evento</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField
                control={form.control}
                name="eventType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de evento</FormLabel>
                    <EnumSelect
                      value={field.value}
                      onChange={field.onChange}
                      options={MOVEMENT_EVENT_TYPES}
                    />
                  </FormItem>
                )}
              />
              {(eventType === "AddItem" || eventType === "RemoveItem") && (
                <FormField
                  control={form.control}
                  name="tileItem"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-2 self-end pb-2">
                      <FormControl>
                        <input
                          type="checkbox"
                          className="size-4"
                          checked={Boolean(field.value)}
                          onChange={(event) =>
                            field.onChange(event.target.checked)
                          }
                        />
                      </FormControl>
                      <FormLabel className="!mt-0 font-normal">
                        Item no chão (tileitem — variante AddItem/RemoveItem)
                      </FormLabel>
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Seletor de item</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="selectorType"
                render={({ field }) => (
                  <FormItem className="sm:max-w-xs">
                    <FormLabel>Tipo de seletor</FormLabel>
                    <EnumSelect
                      value={field.value}
                      onChange={field.onChange}
                      options={MOVEMENT_SELECTOR_TYPES}
                    />
                  </FormItem>
                )}
              />

              {selectorType === "ITEM_ID" && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <EntitySearchCombobox<ItemInput & { id: number }>
                      endpoint="/api/admin/items"
                      value={form.watch("itemId")}
                      placeholder="Buscar item..."
                      formatOption={(item) => `#${item.id} — ${item.name}`}
                      onSelect={(item) =>
                        form.setValue("itemId", item?.id ?? null)
                      }
                    />
                    {form.watch("itemId") != null && (
                      <EntityThumb
                        entityType="item"
                        id={form.watch("itemId") as number}
                      />
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <NumberField
                      control={form.control}
                      name="itemId"
                      label="Item id"
                    />
                    <NumberField
                      control={form.control}
                      name="itemIdRangeEnd"
                      label="Até item id (opcional — forma 100-105)"
                    />
                  </div>
                </div>
              )}

              {selectorType === "ITEM_RANGE" && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground">
                    Pares fromid/toid (listas paralelas, ex.:
                    fromid=&quot;100;200&quot; toid=&quot;105;205&quot;).
                  </p>
                  {ranges.fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="grid grid-cols-[1fr_1fr_auto] items-center gap-2"
                    >
                      <NumberField
                        control={form.control}
                        name={`ranges.${index}.from`}
                        label="De (From)"
                      />
                      <NumberField
                        control={form.control}
                        name={`ranges.${index}.to`}
                        label="Até (To)"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="self-end"
                        onClick={() => ranges.remove(index)}
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
                    onClick={() => ranges.append(emptyMovementIdRange)}
                  >
                    <Plus className="size-4" />
                    Adicionar par
                  </Button>
                </div>
              )}

              {selectorType === "UNIQUE_ID" && (
                <NumberField
                  control={form.control}
                  name="uniqueId"
                  label="Id único (Unique id)"
                />
              )}

              {selectorType === "ACTION_ID" && (
                <NumberField
                  control={form.control}
                  name="actionId"
                  label="Id de ação (Action id)"
                />
              )}
            </CardContent>
          </Card>

          {isEquipEvent && (
            <Card>
              <CardHeader>
                <CardTitle>Equip/DeEquip</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <FormField
                    control={form.control}
                    name="slot"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Slot</FormLabel>
                        <EnumSelect
                          value={field.value}
                          onChange={field.onChange}
                          options={MOVEMENT_SLOTS}
                        />
                      </FormItem>
                    )}
                  />
                  <NumberField
                    control={form.control}
                    name="level"
                    label="Nível mínimo (level)"
                  />
                  <NumberField
                    control={form.control}
                    name="magicLevel"
                    label="Nível mágico mínimo (magicLevel)"
                  />
                  <FormField
                    control={form.control}
                    name="premium"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center gap-2 self-end pb-2">
                        <FormControl>
                          <input
                            type="checkbox"
                            className="size-4"
                            checked={Boolean(field.value)}
                            onChange={(event) =>
                              field.onChange(event.target.checked)
                            }
                          />
                        </FormControl>
                        <FormLabel className="!mt-0 font-normal">
                          Requer premium (premium)
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
                <MovementVocationField
                  control={form.control}
                  name="vocations"
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Ação</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="actionKind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de ação</FormLabel>
                    <EnumSelect
                      value={field.value}
                      onChange={field.onChange}
                      options={MOVEMENT_ACTION_KINDS}
                    />
                  </FormItem>
                )}
              />
              {actionKind === "FUNCTION" ? (
                <FormField
                  control={form.control}
                  name="actionValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Função nativa</FormLabel>
                      <EnumSelect
                        value={field.value}
                        onChange={field.onChange}
                        options={["", ...MOVEMENT_FUNCTION_NAMES] as const}
                      />
                    </FormItem>
                  )}
                />
              ) : (
                <div className="flex flex-col gap-2">
                  <FormField
                    control={form.control}
                    name="actionValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Arquivo de script (.lua)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="swimming.lua" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">
                      Vincular um script já cadastrado na categoria{" "}
                      <code>movements</code> (preenche o campo acima com o nome
                      do arquivo):
                    </p>
                    <EntitySearchCombobox<{
                      id: number;
                      name: string;
                      category: string;
                    }>
                      endpoint="/api/admin/lua-scripts?category=movements"
                      value={form.watch("luaScriptId")}
                      placeholder="Buscar script Lua (categoria movements)..."
                      formatOption={(script) => script.name}
                      onSelect={(script) => {
                        form.setValue("luaScriptId", script?.id ?? null);
                        if (script) form.setValue("actionValue", script.name);
                      }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              nativeButton={false}
              render={<Link href="/admin/movements" />}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              {isSubmitting
                ? "Salvando..."
                : isEditing
                  ? "Salvar alterações"
                  : "Criar movement"}
            </Button>
          </div>
        </form>
      </Form>

      <div className="flex flex-col gap-6 lg:sticky lg:top-6">
        <XmlPreviewCard value={previewXml} />

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Pré-visualização das sprites</CardTitle>
          </CardHeader>
          <CardContent>
            <EntitySpritePreview items={spritePreviewItems} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
