"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type FieldPath,
} from "react-hook-form";
import { ImageOff, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  FIELD_TYPES,
  FLOOR_CHANGES,
  ITEM_ABSORB_KEYS,
  ITEM_ELEMENT_KEYS,
  ITEM_FIELD_ABSORB_KEYS,
  ITEM_SKILL_KEYS,
  ITEM_SUPPRESS_KEYS,
  ITEM_TYPES,
  SLOT_TYPES,
  WEAPON_TYPES,
  defaultItemValues,
  emptyFieldDamage,
  itemSchema,
  type ItemInput,
} from "@/lib/validations/admin/item";
import type { SpellFormInput } from "@/lib/validations/admin/spell";
import { itemToXml } from "@/lib/item-xml";
import type { Looktype } from "@/lib/generated/prisma/client";
import {
  LOOKTYPE_CATEGORY_LABELS,
  formatLooktypeOption,
  type LooktypeCategory,
} from "@/lib/validations/admin/looktype";
import { LooktypeAnimatedImage } from "@/components/shared/looktype-animated-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { NumberField } from "@/components/shared/number-field";
import { RecordGridField } from "@/components/shared/record-grid-field";
import { BooleanGridField } from "@/components/shared/boolean-grid-field";
import { EntitySearchCombobox } from "@/components/shared/entity-search-combobox";
import { ItemIdField } from "@/components/shared/item-id-field";
import { EntityImageUpload } from "@/components/shared/entity-image-upload";
import { EntityThumb } from "@/components/shared/entity-thumb";
import { XmlPreviewCard } from "@/components/shared/xml-preview-card";
import { ScrollableTabsList } from "@/components/shared/scrollable-tabs-list";
import { CollapsibleSectionCard } from "@/components/shared/collapsible-section-card";
import { ItemLinkedMovementsPanel } from "@/components/admin/items/item-linked-movements-panel";
import {
  ItemConflictDialog,
  type ItemConflict,
  type ItemConflictDecision,
} from "@/components/admin/items/item-conflict-dialog";
import { FieldTooltip } from "@/components/shared/field-tooltip";
import { WeightField } from "@/components/shared/weight-field";
import { Textarea } from "@/components/ui/textarea";
import {
  ABSORB_TOOLTIP,
  ELEMENT_DAMAGE_TOOLTIP,
  ELEMENT_LABELS,
  ENUM_LABELS,
  FIELD_ABSORB_TOOLTIP,
  FIELD_HELP,
  FLAG_LABELS,
  FLAG_TOOLTIPS,
  REFLECT_CHANCE_TOOLTIP,
  REFLECT_PERCENT_TOOLTIP,
  SKILL_LABELS,
  SKILL_TOOLTIP,
  SUPPRESS_LABELS,
  SUPPRESS_TOOLTIP,
} from "@/lib/item-field-help";

type ItemFormProps = {
  itemId?: number;
  initialValues?: ItemInput;
  /** "page" (padrão): usado pelas rotas /admin/items/new e /admin/items/[id] — form completo,
   * com botões de ação e navegação após salvar. "embedded": usado pelo dialog de edição em
   * massa — sem botões de ação, sem navegação, sem modo range (cada painel é sempre um item
   * concreto); quem salva é o `submit()` exposto via `ref`. */
  mode?: "page" | "embedded";
};

export type ItemSubmitResult =
  /** `skipped` true = o id já existia com exatamente a mesma configuração — nada foi gravado e
   * `item` é o cadastro existente. */
  | { ok: true; item: ItemInput; skipped?: boolean }
  /** `conflict` true = criação recusada por já existir um item com esse id e configuração
   * diferente (409) — `existing` traz o cadastro atual pra comparação antes de sobrescrever. */
  | { ok: false; conflict: boolean; error: string; existing?: ItemInput };

type ConflictAnswer = { decision: ItemConflictDecision; applyToRemaining: boolean };

export type ItemFormHandle = {
  getValues: () => ItemInput;
  isDirty: () => boolean;
  submit: (options?: { forceOverwrite?: boolean }) => Promise<ItemSubmitResult>;
};

/** Mesmo teto de `POST /api/admin/items/range` — evita gerar uma lista gigante de linhas na aba
 * "Outras sprites" antes mesmo de a API rejeitar o range. */
const MAX_RANGE = 500;

type RangeSpriteRow = {
  itemId: number;
  clientId: number | null;
  lookTypeId: number | null;
  pendingLooktype: Looktype | null;
};

/** Agrupamento das flags na aba "Comportamento" — as chaves são as mesmas de `itemFlagsSchema`. */
const FLAG_GROUPS: { title: string; tooltip: string; keys: string[] }[] = [
  {
    title: "Colisão",
    tooltip: "Como o item impede ou permite a passagem de criaturas e projéteis.",
    keys: ["blocking", "blockProjectile", "blockPathfind", "walkStack"],
  },
  {
    title: "Interação",
    tooltip: "O que o jogador pode fazer com o item: mover, pegar, girar.",
    keys: ["movable", "pickupable", "allowPickupable", "rotable"],
  },
  {
    title: "Exibição e leitura",
    tooltip: "Como o item aparece na descrição e se o texto dele pode ser lido.",
    keys: ["showCount", "canReadText", "allowDistRead"],
  },
  {
    title: "Equipamento e morte",
    tooltip: "Efeitos ao equipar o item e o que acontece com ele quando o jogador morre.",
    keys: ["dualWield", "invisible", "preventLoss", "preventDrop"],
  },
  {
    title: "Sistema",
    tooltip: "Flags técnicas do servidor (salvamento e substituição de campos).",
    keys: ["forceSerialize", "replacable"],
  },
];

function LabelWithTooltip({
  label,
  tooltip,
  className,
}: {
  label: string;
  tooltip?: string;
  className?: string;
}) {
  return (
    <FormLabel className={`flex items-center gap-1.5 ${className ?? ""}`}>
      {label}
      {tooltip && <FieldTooltip text={tooltip} />}
    </FormLabel>
  );
}

/** Checkbox com rótulo e (i) — evita repetir o bloco de FormField em cada booleano do form. */
function CheckField({
  control,
  name,
  label,
  tooltip,
}: {
  control: Control<ItemInput>;
  name: FieldPath<ItemInput>;
  label: string;
  tooltip?: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex flex-row items-center gap-2">
          <FormControl>
            <input
              type="checkbox"
              className="size-4 cursor-pointer"
              checked={Boolean(field.value)}
              onChange={(event) => field.onChange(event.target.checked)}
            />
          </FormControl>
          <LabelWithTooltip label={label} tooltip={tooltip} className="!mt-0 font-normal" />
        </FormItem>
      )}
    />
  );
}

function TextField({
  control,
  name,
  label,
  tooltip,
  placeholder,
  className,
  multiline,
  maxLength,
}: {
  control: Control<ItemInput>;
  name: FieldPath<ItemInput>;
  label: string;
  tooltip?: string;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  maxLength?: number;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const value = (field.value as string | null | undefined) ?? "";
        return (
          <FormItem className={className}>
            <LabelWithTooltip label={label} tooltip={tooltip} />
            <FormControl>
              {multiline ? (
                <Textarea
                  {...field}
                  value={value}
                  maxLength={maxLength}
                  rows={3}
                  placeholder={placeholder}
                />
              ) : (
                <Input {...field} value={value} placeholder={placeholder} />
              )}
            </FormControl>
            {multiline && maxLength && (
              <p className="text-right text-xs text-muted-foreground">
                {value.length}/{maxLength}
              </p>
            )}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

function EnumField({
  control,
  name,
  label,
  tooltip,
  options,
  optionLabels,
}: {
  control: Control<ItemInput>;
  name: FieldPath<ItemInput>;
  label: string;
  tooltip?: string;
  options: readonly string[];
  optionLabels?: Record<string, string>;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <LabelWithTooltip label={label} tooltip={tooltip} />
          <EnumSelect
            value={(field.value as string | null | undefined) ?? ""}
            onChange={field.onChange}
            options={options}
            optionLabels={optionLabels}
          />
        </FormItem>
      )}
    />
  );
}

function EnumSelect({
  value,
  onChange,
  options,
  optionLabels,
  placeholder = "—",
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  optionLabels?: Record<string, string>;
  placeholder?: string;
}) {
  return (
    <Select
      value={value || "__empty"}
      onValueChange={(next) =>
        onChange(next === "__empty" || next == null ? "" : next)
      }
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option || "__empty"} value={option || "__empty"}>
            {option ? (optionLabels?.[option] ?? option) : "(nenhum)"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export const ItemForm = forwardRef<ItemFormHandle, ItemFormProps>(function ItemForm(
  { itemId, initialValues, mode = "page" },
  ref,
) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = itemId != null;

  const [idMode, setIdMode] = useState<"single" | "range">("single");
  const rangeMode = idMode === "range";
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  // Dados de client id/sprite por id do range, mantidos à parte do fromId/toId atuais — assim o
  // que já foi digitado/vinculado sobrevive a ajustes no intervalo (ex.: estreitar e alargar de
  // volta o range não perde o que já estava preenchido pros ids que continuam nele).
  const [rangeSpriteData, setRangeSpriteData] = useState<
    Map<number, { clientId: number | null; lookTypeId: number | null; pendingLooktype: Looktype | null }>
  >(new Map());
  const [rangeSpritePickerFor, setRangeSpritePickerFor] = useState<number | null>(null);

  // Conflito de id aguardando a decisão do admin (substituir/pular) no `ItemConflictDialog` — o
  // submit fica parado no `await askConflict(...)` até o dialog resolver a Promise.
  const [pendingConflict, setPendingConflict] = useState<ItemConflict | null>(null);
  const conflictResolverRef = useRef<((answer: ConflictAnswer) => void) | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null);
  const [pendingLooktype, setPendingLooktype] = useState<Looktype | null>(null);
  const [showLooktypePicker, setShowLooktypePicker] = useState(false);
  // Resultado do auto-lookup por client id em modo edição — repassado pro `EntityImageUpload`
  // como candidato de auto-vínculo (ele decide se ainda não há nada vinculado antes de aplicar).
  const [autoLookupLooktype, setAutoLookupLooktype] = useState<Looktype | null>(null);
  // Guarda o último client id já pesquisado em cada contexto (single/edição/cada linha do range)
  // pra não repetir a busca quando o campo perde foco sem o valor ter mudado, mas ainda assim
  // refazer a busca sempre que o client id for alterado de fato (mesmo depois de já ter algo
  // vinculado — o vínculo antigo deixou de fazer sentido pro novo client id).
  const lastAutoSearchedClientIdRef = useRef<number | null>(null);
  const lastAutoSearchedClientIdEditRef = useRef<number | null>(null);
  const lastAutoSearchedRangeClientIdsRef = useRef<Map<number, number>>(new Map());

  const rangeSpriteRows: RangeSpriteRow[] = (() => {
    if (!rangeMode) return [];
    const from = Number(fromId);
    const to = Number(toId);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) return [];

    const count = Math.min(to - from + 1, MAX_RANGE);
    return Array.from({ length: count }, (_, i) => {
      const id = from + i;
      const data = rangeSpriteData.get(id);
      return {
        itemId: id,
        clientId: data?.clientId ?? null,
        lookTypeId: data?.lookTypeId ?? null,
        pendingLooktype: data?.pendingLooktype ?? null,
      };
    });
  })();

  function updateRangeSpriteRow(itemId: number, patch: Partial<Omit<RangeSpriteRow, "itemId">>) {
    setRangeSpriteData((current) => {
      const next = new Map(current);
      const existing = next.get(itemId) ?? { clientId: null, lookTypeId: null, pendingLooktype: null };
      next.set(itemId, { ...existing, ...patch });
      return next;
    });
  }

  const form = useForm<ItemInput, unknown, ItemInput>({
    resolver: zodResolver(itemSchema),
    defaultValues: initialValues ?? defaultItemValues,
  });

  const extraAttributes = useFieldArray({
    control: form.control,
    name: "extraAttributes",
  });
  const fieldDamages = useFieldArray({
    control: form.control,
    name: "field.damages",
  });

  const watched = useWatch({ control: form.control });

  // Criação: só habilita o Salvar com os obrigatórios preenchidos (nome e id, ou o range de ids
  // válido). Edição: a barra só aparece quando algo no form foi alterado.
  const requiredFilled = (() => {
    if (!watched.name?.trim()) return false;
    if (rangeMode) {
      const from = Number(fromId);
      const to = Number(toId);
      return Number.isInteger(from) && Number.isInteger(to) && from >= 1 && to >= from;
    }
    return Number.isInteger(watched.id) && (watched.id ?? 0) >= 1;
  })();
  const canSave = isEditing ? form.formState.isDirty : requiredFilled;
  const showActionBar = !isEditing || form.formState.isDirty;
  const previewXml =
    !isEditing && rangeMode
      ? itemToXml({
          ...defaultItemValues,
          ...watched,
          id: Number(fromId) || 0,
        } as ItemInput).replace(
          /^<item id="\d+"/,
          `<item fromid="${fromId || 0}" toid="${toId || 0}"`,
        )
      : itemToXml({
          ...defaultItemValues,
          ...watched,
        } as ItemInput);

  /** Busca a looktype de item cujo nome referencia o `clientId` informado (convenção
   * `item_{clientId}`) e devolve o registro completo (já com os campos de preview), pronto pra
   * exibir com `LooktypeAnimatedImage`. Retorna `null` sem lançar erro quando nada é encontrado —
   * é uma tentativa best-effort disparada no blur do campo, o admin ainda pode vincular
   * manualmente pelo combobox se a convenção de nome não bater. */
  async function lookupLooktypeByClientId(clientId: number): Promise<Looktype | null> {
    const found = await fetch(`/api/admin/looktypes/by-client-id?clientId=${clientId}`)
      .then((res) => res.json())
      .catch(() => null);
    if (!found?.found) return null;

    const detail = await fetch(`/api/admin/looktypes?id=${found.looktype.id}`)
      .then((res) => res.json())
      .catch(() => null);
    return detail?.data?.[0] ?? null;
  }

  function handlePendingImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setPendingImagePreview((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(file);
    });
    setPendingImageFile(file);
    clearPendingLooktype();
  }

  function handlePendingLooktypeSelect(looktype: Looktype | null) {
    if (!looktype) return;
    clearPendingImage();
    setPendingLooktype(looktype);
    setShowLooktypePicker(false);
    form.setValue("lookTypeId", looktype.id);
  }

  function clearPendingLooktype() {
    setPendingLooktype(null);
    setShowLooktypePicker(false);
    form.setValue("lookTypeId", null);
  }

  function clearPendingImage() {
    setPendingImagePreview((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
    setPendingImageFile(null);
  }

  async function uploadPendingImage(id: number, file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`/api/admin/images/item/${id}`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      toast.error("Item criado, mas não foi possível enviar a imagem.");
    }
  }

  async function linkPendingLooktype(id: number, looktypeId: number) {
    const response = await fetch(`/api/admin/images/item/${id}/link-looktype`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ looktypeId }),
    });

    if (!response.ok) {
      toast.error("Item criado, mas não foi possível vincular a sprite.");
    }
  }

  /** Cria ou atualiza o item via API — reaproveitado tanto pelo submit nativo do form (modo
   * "page") quanto pelo `submit()` imperativo exposto via `ref` (modo "embedded", usado pelo
   * dialog de edição em massa). `forceOverwrite` faz PATCH em `values.id` mesmo quando o form
   * nasceu como criação — usado depois que o admin confirma sobrescrever um id que já existe. */
  async function doSave(values: ItemInput, forceOverwrite = false): Promise<ItemSubmitResult> {
    const editingThisSave = isEditing || forceOverwrite;
    const targetId = isEditing ? itemId : values.id;
    const url = editingThisSave ? `/api/admin/items/${targetId}` : "/api/admin/items";
    const method = editingThisSave ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      return {
        ok: false,
        conflict: !editingThisSave && response.status === 409,
        error: data?.error ?? "Não foi possível salvar o item.",
        existing: data?.existing,
      };
    }

    const data = await response.json();

    // Id já existia com a mesma configuração: nada foi gravado, então também não mexe na imagem
    // do cadastro existente — quem chamou decide o que fazer com uma imagem pendente.
    if (data?.skipped) return { ok: true, item: data.item as ItemInput, skipped: true };

    if (pendingImageFile && data?.item?.id) {
      await uploadPendingImage(data.item.id, pendingImageFile);
    } else if (pendingLooktype && data?.item?.id) {
      await linkPendingLooktype(data.item.id, pendingLooktype.id);
    }

    return { ok: true, item: data.item as ItemInput };
  }

  function askConflict(conflict: ItemConflict): Promise<ConflictAnswer> {
    return new Promise((resolve) => {
      conflictResolverRef.current = resolve;
      setPendingConflict(conflict);
    });
  }

  function handleConflictResolve(decision: ItemConflictDecision, applyToRemaining: boolean) {
    const resolve = conflictResolverRef.current;
    conflictResolverRef.current = null;
    setPendingConflict(null);
    resolve?.({ decision, applyToRemaining });
  }

  useImperativeHandle(ref, () => ({
    getValues: () => form.getValues(),
    isDirty: () => form.formState.isDirty,
    submit: async (options) => {
      const valid = await form.trigger();
      if (!valid) {
        return {
          ok: false,
          conflict: false,
          error: "Há campos inválidos — confira as abas com erro.",
        };
      }
      return doSave(form.getValues(), options?.forceOverwrite ?? false);
    },
  }));

  async function onSubmit(values: ItemInput) {
    setIsSubmitting(true);

    if (!isEditing && rangeMode) {
      const from = Number(fromId);
      const to = Number(toId);

      if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {
        setIsSubmitting(false);
        toast.error("Informe um range de ids válido (de/até).");
        return;
      }

      const overrides = rangeSpriteRows
        .filter((row) => row.clientId != null || row.lookTypeId != null)
        .map((row) => ({ id: row.itemId, clientId: row.clientId, lookTypeId: row.lookTypeId }));

      const response = await fetch("/api/admin/items/range", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromId: from, toId: to, item: values, overrides }),
      });

      if (!response.ok) {
        setIsSubmitting(false);
        const data = await response.json().catch(() => null);
        toast.error(data?.error ?? "Não foi possível criar os items.");
        return;
      }

      // Os ids livres já foram criados pela API; só os existentes com configuração diferente
      // voltam aqui, e cada um espera a decisão do admin sem desfazer o que já foi criado.
      const data: {
        created: number[];
        skipped: number[];
        conflicts: { existing: ItemInput; incoming: ItemInput }[];
      } = await response.json();

      if (data.conflicts.length > 0) {
        toast.info(
          `${data.created.length} item(ns) criado(s), ${data.skipped.length} idêntico(s) ignorado(s) — ${data.conflicts.length} já existente(s) aguardando decisão.`,
        );
      }

      const replaced: number[] = [];
      const declined: number[] = [];
      const failures: string[] = [];
      let decisionForRemaining: ItemConflictDecision | null = null;

      for (const [index, conflict] of data.conflicts.entries()) {
        const id = conflict.incoming.id;
        let decision = decisionForRemaining;
        if (!decision) {
          const answer = await askConflict({
            ...conflict,
            incomingSprite: { looktype: rangeSpriteData.get(id)?.pendingLooktype ?? null },
            remaining: data.conflicts.length - index - 1,
          });
          decision = answer.decision;
          if (answer.applyToRemaining) decisionForRemaining = answer.decision;
        }

        if (decision === "skip") {
          declined.push(id);
          continue;
        }

        const patch = await fetch(`/api/admin/items/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(conflict.incoming),
        });
        if (patch.ok) {
          replaced.push(id);
        } else {
          const error = await patch.json().catch(() => null);
          failures.push(`#${id}: ${error?.error ?? "não foi possível substituir"}`);
        }
      }

      setIsSubmitting(false);

      const summary = [
        `${data.created.length} criado(s)`,
        replaced.length > 0 && `${replaced.length} substituído(s)`,
        data.skipped.length > 0 && `${data.skipped.length} idêntico(s) ignorado(s)`,
        declined.length > 0 && `${declined.length} pulado(s)`,
      ]
        .filter(Boolean)
        .join(", ");
      if (failures.length > 0) toast.error(`Falha ao substituir: ${failures.join("; ")}`);

      if (data.created.length + replaced.length === 0) {
        toast.info(`Range #${from}–#${to}: ${summary}. Nenhum item foi gravado.`);
        return;
      }

      toast.success(`Range #${from}–#${to}: ${summary}.`);
      router.push("/admin/items");
      router.refresh();
      return;
    }

    const result = await doSave(values);

    if (!isEditing) {
      // Id já cadastrado: com a mesma configuração (e sem imagem nova pendente) não há nada a
      // gravar; divergente pergunta se substitui, mostrando os dois cadastros lado a lado.
      const existing = result.ok
        ? result.skipped && pendingImageFile
          ? result.item
          : null
        : result.conflict
          ? (result.existing ?? null)
          : null;

      if (result.ok && result.skipped && !existing) {
        setIsSubmitting(false);
        toast.info(`Item #${values.id} já existe com a mesma configuração — nada foi alterado.`);
        router.push("/admin/items");
        router.refresh();
        return;
      }

      if (existing) {
        const { decision } = await askConflict({
          existing,
          incoming: values,
          incomingSprite: { looktype: pendingLooktype, imagePreviewUrl: pendingImagePreview },
        });
        if (decision === "skip") {
          setIsSubmitting(false);
          return;
        }

        const overwrite = await doSave(values, true);
        setIsSubmitting(false);
        if (!overwrite.ok) {
          toast.error(overwrite.error);
          return;
        }
        toast.success(`Item #${values.id} substituído.`);
        router.push("/admin/items");
        router.refresh();
        return;
      }
    }

    setIsSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(isEditing ? "Item atualizado." : "Item criado.");
    router.push("/admin/items");
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <Form {...form}>
        <form
          onSubmit={mode === "page" ? form.handleSubmit(onSubmit) : (event) => event.preventDefault()}
          className="flex flex-col gap-6"
        >
          <Tabs defaultValue="basic">
            <ScrollableTabsList>
              <TabsTrigger value="basic">Básico</TabsTrigger>
              {!isEditing && rangeMode && (
                <TabsTrigger value="other-sprites">Outras sprites</TabsTrigger>
              )}
              <TabsTrigger value="combat">Combate</TabsTrigger>
              <TabsTrigger value="resist">Proteções</TabsTrigger>
              <TabsTrigger value="decay">Decay/Transformação</TabsTrigger>
              <TabsTrigger value="container">Container/Texto</TabsTrigger>
              <TabsTrigger value="regen">Luz e Bônus</TabsTrigger>
              <TabsTrigger value="field">Campo mágico</TabsTrigger>
              <TabsTrigger value="flags">Comportamento (flags)</TabsTrigger>
              <TabsTrigger value="extra">Atributos extras</TabsTrigger>
              <TabsTrigger value="movements">Movements vinculados</TabsTrigger>
            </ScrollableTabsList>

            <TabsContent value="basic">
              <CollapsibleSectionCard
                title="Identificação"
                contentClassName="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                  <div className="flex items-start justify-between gap-4 sm:col-span-2 lg:col-span-3">
                  {!isEditing && mode === "page" ? (
                    <div className="flex flex-col gap-2">
                      <Label className="font-normal">Forma de informar o ID do item</Label>
                      <RadioGroup
                        orientation="horizontal"
                        value={idMode}
                        onValueChange={(value) => setIdMode(value as "single" | "range")}
                      >
                        <label className="flex items-center gap-1.5 text-sm">
                          <RadioGroupItem value="range" />
                          Range de items
                        </label>
                        <label className="flex items-center gap-1.5 text-sm">
                          <RadioGroupItem value="single" />
                          Apenas id
                        </label>
                      </RadioGroup>
                      {rangeMode && (
                        <p className="text-xs text-muted-foreground">
                          Mesmo nome/atributos, vários ids — equivalente a{" "}
                          <code>fromid</code>/<code>toid</code> no <code>items.xml</code>.
                          Sprite/client id individuais por id podem ser definidos na aba
                          &quot;Outras sprites&quot;.
                        </p>
                      )}
                    </div>
                  ) : (
                    <span />
                  )}
                  <CheckField
                    control={form.control}
                    name="published"
                    label="Publicado no site"
                    tooltip={FIELD_HELP.published}
                  />
                  </div>
                  {!isEditing && rangeMode ? (
                    <>
                      <div className="grid gap-2">
                        <Label htmlFor="range-from-id">ID inicial (from id)</Label>
                        <Input
                          id="range-from-id"
                          type="number"
                          value={fromId}
                          onChange={(event) => {
                            setFromId(event.target.value);
                            // O campo `id` (obrigatório >= 1 no schema) some da tela em modo
                            // range, mas continua fazendo parte do form — sem sincronizar, ele
                            // fica travado no valor padrão (0) e reprova a validação em silêncio
                            // no submit, sem nenhum feedback visível (o FormField dele não está
                            // renderizado pra mostrar o erro).
                            const from = Number(event.target.value);
                            form.setValue("id", Number.isInteger(from) && from > 0 ? from : 0, {
                              shouldValidate: true,
                            });
                          }}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="range-to-id">ID final (to id)</Label>
                        <Input
                          id="range-to-id"
                          type="number"
                          value={toId}
                          onChange={(event) => setToId(event.target.value)}
                        />
                      </div>
                    </>
                  ) : (
                    <NumberField
                      control={form.control}
                      name="id"
                      label="ID (server id)"
                      tooltip={FIELD_HELP.id}
                    />
                  )}
                  <TextField
                    control={form.control}
                    name="name"
                    label="Nome (Name)"
                    tooltip={FIELD_HELP.name}
                  />
                  <TextField
                    control={form.control}
                    name="article"
                    label="Artigo (article)"
                    tooltip={FIELD_HELP.article}
                    placeholder="a, an..."
                  />
                  <TextField
                    control={form.control}
                    name="plural"
                    label="Plural"
                    tooltip={FIELD_HELP.plural}
                  />
                  <TextField
                    control={form.control}
                    name="editorSuffix"
                    label="Sufixo do editor (RME, cosmético)"
                    tooltip={FIELD_HELP.editorSuffix}
                  />
                  <EnumField
                    control={form.control}
                    name="type"
                    label="Tipo (type)"
                    tooltip={FIELD_HELP.type}
                    options={ITEM_TYPES}
                    optionLabels={ENUM_LABELS.type}
                  />
                  {!rangeMode && (
                  <FormField
                    control={form.control}
                    name="clientId"
                    render={({ field }) => (
                      <FormItem>
                        <LabelWithTooltip
                          label="Client ID (sprite no cliente)"
                          tooltip={FIELD_HELP.clientId}
                        />
                        <FormControl>
                          <Input
                            type="number"
                            name={field.name}
                            ref={field.ref}
                            value={(field.value as number | string) ?? ""}
                            onChange={(event) => {
                              field.onChange(
                                event.target.value === "" ? null : Number(event.target.value)
                              );
                            }}
                            onBlur={(event) => {
                              field.onBlur();
                              const clientId = Number(event.target.value);
                              if (!Number.isInteger(clientId) || clientId < 1) return;

                              if (isEditing) {
                                if (lastAutoSearchedClientIdEditRef.current === clientId) return;
                                lastAutoSearchedClientIdEditRef.current = clientId;
                                lookupLooktypeByClientId(clientId).then((looktype) => {
                                  if (looktype) setAutoLookupLooktype(looktype);
                                });
                              } else if (!rangeMode) {
                                if (lastAutoSearchedClientIdRef.current === clientId) return;
                                lastAutoSearchedClientIdRef.current = clientId;
                                lookupLooktypeByClientId(clientId).then((looktype) => {
                                  if (looktype) handlePendingLooktypeSelect(looktype);
                                });
                              }
                            }}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Id do sprite no cliente (diferente do server id).
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  )}
                  <TextField
                    control={form.control}
                    name="description"
                    label="Descrição (Description)"
                    tooltip={FIELD_HELP.description}
                    className="sm:col-span-2 lg:col-span-3"
                    multiline
                    maxLength={255}
                  />
              </CollapsibleSectionCard>

              <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
              <CollapsibleSectionCard
                title="Peso e valor" tooltip="Peso que ocupa na capacidade do jogador e valor em gold do item."
                contentClassName="grid gap-4 sm:grid-cols-2"
              >
                <WeightField
                  control={form.control}
                  name="weight"
                  label="Peso (Weight)"
                  tooltip={FIELD_HELP.weight}
                />
                <NumberField
                  control={form.control}
                  name="worth"
                  label="Valor (Worth)"
                  tooltip={FIELD_HELP.worth}
                />
              </CollapsibleSectionCard>

              <CollapsibleSectionCard
                title="Imagem"
              >
                  {isEditing ? (
                    <EntityImageUpload
                      entityType="item"
                      id={itemId}
                      name={watched.name}
                      autoLinkCandidate={autoLookupLooktype}
                      onLooktypeLinked={(looktypeId) => form.setValue("lookTypeId", looktypeId)}
                      onChanged={() => mutate(["entity-image", "item", itemId])}
                    />
                  ) : rangeMode ? (
                    <p className="text-sm text-muted-foreground">
                      Upload de imagem não está disponível ao cadastrar um range de
                      ids — envie a imagem depois, individualmente, pela listagem.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-4">
                        {pendingLooktype ? (
                          <LooktypeAnimatedImage
                            key={pendingLooktype.id}
                            looktypeId={pendingLooktype.id}
                            frameCount={pendingLooktype.frameCount}
                            frameDurationsMs={pendingLooktype.frameDurationsMs as number[]}
                            updatedAt={pendingLooktype.updatedAt}
                            size="md"
                          />
                        ) : pendingImagePreview ? (
                          // eslint-disable-next-line @next/next/no-img-element -- preview local do arquivo selecionado, ainda não enviado
                          <img
                            src={pendingImagePreview}
                            alt="Preview"
                            className="size-10 shrink-0 rounded-sm border border-border object-contain bg-muted/40"
                          />
                        ) : (
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-sm border border-dashed border-border text-muted-foreground">
                            <ImageOff className="size-4 cursor-pointer" />
                          </span>
                        )}
                        <div className="flex flex-col gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => imageInputRef.current?.click()}
                          >
                            {pendingImageFile ? "Trocar imagem" : "Selecionar imagem"}
                          </Button>
                          {pendingImageFile && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={clearPendingImage}
                            >
                              Remover seleção
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowLooktypePicker((v) => !v)}
                          >
                            Vincular sprite do cadastro
                          </Button>
                          {pendingLooktype && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={clearPendingLooktype}
                            >
                              Remover vínculo
                            </Button>
                          )}
                        </div>
                        <input
                          ref={imageInputRef}
                          type="file"
                          accept="image/png,image/gif"
                          className="hidden"
                          onChange={handlePendingImageChange}
                        />
                      </div>
                      {showLooktypePicker && (
                        <EntitySearchCombobox<Looktype>
                          endpoint="/api/admin/looktypes"
                          value={null}
                          placeholder="Buscar sprite/looktype por id ou número..."
                          formatOption={(lt) =>
                            `${formatLooktypeOption(lt)} — ${LOOKTYPE_CATEGORY_LABELS[lt.category as LooktypeCategory] ?? lt.category}`
                          }
                          renderOption={(lt) => (
                            <span className="flex items-center gap-2">
                              <LooktypeAnimatedImage
                                key={lt.id}
                                looktypeId={lt.id}
                                frameCount={lt.frameCount}
                                frameDurationsMs={lt.frameDurationsMs as number[]}
                                updatedAt={lt.updatedAt}
                                size="sm"
                              />
                              {formatLooktypeOption(lt)} — {LOOKTYPE_CATEGORY_LABELS[lt.category as LooktypeCategory] ?? lt.category}
                            </span>
                          )}
                          onSelect={handlePendingLooktypeSelect}
                        />
                      )}
                      <p className="text-xs text-muted-foreground">
                        PNG ou GIF, até 2MB. A imagem (ou a sprite vinculada) é aplicada
                        automaticamente assim que o item for criado.
                      </p>
                    </div>
                  )}
              </CollapsibleSectionCard>
              </div>
            </TabsContent>

            {!isEditing && rangeMode && (
              <TabsContent value="other-sprites">
                <CollapsibleSectionCard
                  title="Outras sprites"
                  contentClassName="flex flex-col gap-2"
                >
                  <p className="text-sm text-muted-foreground">
                    Uma linha por id do range ({fromId || "?"}–{toId || "?"}). Client id e
                    sprite vinculada ficam individuais por item; os demais atributos vêm das
                    outras abas e são compartilhados por todos os ids criados.
                  </p>
                  {rangeSpriteRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Informe um range de ids válido na aba Básico para listar os itens aqui.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)] gap-2 text-xs font-medium text-muted-foreground">
                        <span>Item ID</span>
                        <span>Client ID</span>
                        <span>Sprite</span>
                      </div>
                      {rangeSpriteRows.map((row) => (
                        <div
                          key={row.itemId}
                          className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)] items-center gap-2"
                        >
                          <Input value={row.itemId} readOnly disabled />
                          <Input
                            type="number"
                            value={row.clientId ?? ""}
                            onChange={(event) =>
                              updateRangeSpriteRow(row.itemId, {
                                clientId: event.target.value === "" ? null : Number(event.target.value),
                              })
                            }
                            onBlur={(event) => {
                              const clientId = Number(event.target.value);
                              if (!Number.isInteger(clientId) || clientId < 1) return;
                              if (lastAutoSearchedRangeClientIdsRef.current.get(row.itemId) === clientId) return;
                              lastAutoSearchedRangeClientIdsRef.current.set(row.itemId, clientId);
                              lookupLooktypeByClientId(clientId).then((looktype) => {
                                if (!looktype) return;
                                updateRangeSpriteRow(row.itemId, { lookTypeId: looktype.id, pendingLooktype: looktype });
                              });
                            }}
                          />
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              {row.pendingLooktype ? (
                                <LooktypeAnimatedImage
                                  key={row.pendingLooktype.id}
                                  looktypeId={row.pendingLooktype.id}
                                  frameCount={row.pendingLooktype.frameCount}
                                  frameDurationsMs={row.pendingLooktype.frameDurationsMs as number[]}
                                  updatedAt={row.pendingLooktype.updatedAt}
                                  size="sm"
                                />
                              ) : (
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-dashed border-border text-muted-foreground">
                                  <ImageOff className="size-4" />
                                </span>
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setRangeSpritePickerFor((current) =>
                                    current === row.itemId ? null : row.itemId,
                                  )
                                }
                              >
                                Vincular sprite
                              </Button>
                              {row.pendingLooktype && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    updateRangeSpriteRow(row.itemId, { lookTypeId: null, pendingLooktype: null })
                                  }
                                >
                                  Remover vínculo
                                </Button>
                              )}
                            </div>
                            {rangeSpritePickerFor === row.itemId && (
                              <EntitySearchCombobox<Looktype>
                                endpoint="/api/admin/looktypes"
                                value={null}
                                placeholder="Buscar sprite/looktype por id ou número..."
                                formatOption={(lt) =>
                                  `${formatLooktypeOption(lt)} — ${LOOKTYPE_CATEGORY_LABELS[lt.category as LooktypeCategory] ?? lt.category}`
                                }
                                renderOption={(lt) => (
                                  <span className="flex items-center gap-2">
                                    <LooktypeAnimatedImage
                                      key={lt.id}
                                      looktypeId={lt.id}
                                      frameCount={lt.frameCount}
                                      frameDurationsMs={lt.frameDurationsMs as number[]}
                                      updatedAt={lt.updatedAt}
                                      size="sm"
                                    />
                                    {formatLooktypeOption(lt)} — {LOOKTYPE_CATEGORY_LABELS[lt.category as LooktypeCategory] ?? lt.category}
                                  </span>
                                )}
                                onSelect={(lt) => {
                                  if (!lt) return;
                                  updateRangeSpriteRow(row.itemId, { lookTypeId: lt.id, pendingLooktype: lt });
                                  setRangeSpritePickerFor(null);
                                }}
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CollapsibleSectionCard>
              </TabsContent>
            )}

            <TabsContent value="combat">
              <CollapsibleSectionCard
                title="Classificação de combate" tooltip="Define que tipo de arma/equipamento o item é e como ele dispara ou é equipado."
                contentClassName="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                <EnumField
                  control={form.control}
                  name="weaponType"
                  label="Tipo de arma (Weapon type)"
                  tooltip={FIELD_HELP.weaponType}
                  options={WEAPON_TYPES}
                  optionLabels={ENUM_LABELS.weaponType}
                />
                <EnumField
                  control={form.control}
                  name="slotType"
                  label="Tipo de slot (Slot type)"
                  tooltip={FIELD_HELP.slotType}
                  options={SLOT_TYPES}
                  optionLabels={ENUM_LABELS.slotType}
                />
                <TextField
                  control={form.control}
                  name="ammoType"
                  label="Tipo de munição (Ammo type)"
                  tooltip={FIELD_HELP.ammoType}
                  placeholder="arrow, bolt..."
                />
                <TextField
                  control={form.control}
                  name="ammoAction"
                  label="Ação de munição (Ammo action)"
                  tooltip={FIELD_HELP.ammoAction}
                  placeholder="removecount..."
                />
                <TextField
                  control={form.control}
                  name="shootType"
                  label="Tipo de projétil (Shoot type)"
                  tooltip={FIELD_HELP.shootType}
                  placeholder="arrow, bolt, spear..."
                />
                <TextField
                  control={form.control}
                  name="effect"
                  label="Efeito visual (Effect)"
                  tooltip={FIELD_HELP.effect}
                />
                <TextField
                  control={form.control}
                  name="corpseType"
                  label="Tipo de corpo (Corpse type)"
                  tooltip={FIELD_HELP.corpseType}
                  placeholder="venom, blood, undead..."
                />
              </CollapsibleSectionCard>

              <CollapsibleSectionCard
                title="Ataque e defesa" tooltip="Números de combate do item. Deixe 0 nos que não se aplicam."
                className="mt-4"
                contentClassName="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
              >
                <NumberField control={form.control} name="attack" label="Ataque (Attack)" tooltip={FIELD_HELP.attack} />
                <NumberField control={form.control} name="extraAttack" label="Ataque extra (Extra attack)" tooltip={FIELD_HELP.extraAttack} />
                <NumberField control={form.control} name="attackSpeed" label="Velocidade de ataque (Attack speed)" tooltip={FIELD_HELP.attackSpeed} />
                <NumberField control={form.control} name="defense" label="Defesa (Defense)" tooltip={FIELD_HELP.defense} />
                <NumberField control={form.control} name="extraDefense" label="Defesa extra (Extra defense)" tooltip={FIELD_HELP.extraDefense} />
                <NumberField control={form.control} name="armor" label="Armadura (Armor)" tooltip={FIELD_HELP.armor} />
                <NumberField control={form.control} name="range" label="Alcance (Range)" tooltip={FIELD_HELP.range} />
                <NumberField control={form.control} name="hitChance" label="Chance de acerto (Hit chance)" tooltip={FIELD_HELP.hitChance} />
                <NumberField control={form.control} name="maxHitChance" label="Chance máxima de acerto (Max hit chance)" tooltip={FIELD_HELP.maxHitChance} />
                <NumberField control={form.control} name="breakChance" label="Chance de quebra (Break chance)" tooltip={FIELD_HELP.breakChance} />
              </CollapsibleSectionCard>

              <CollapsibleSectionCard
                title="Skills concedidas" tooltip={SKILL_TOOLTIP}
                className="mt-4"
              >
                <RecordGridField
                  control={form.control}
                  basePath="skills"
                  keys={ITEM_SKILL_KEYS}
                  labels={SKILL_LABELS}
                  tooltips={Object.fromEntries(ITEM_SKILL_KEYS.map((key) => [key, SKILL_TOOLTIP]))}
                />
              </CollapsibleSectionCard>

              <CollapsibleSectionCard
                title="Dano elemental (arma)" tooltip={ELEMENT_DAMAGE_TOOLTIP}
                className="mt-4"
              >
                <RecordGridField
                  control={form.control}
                  basePath="elements"
                  keys={ITEM_ELEMENT_KEYS}
                  labels={ELEMENT_LABELS}
                />
              </CollapsibleSectionCard>

              <CollapsibleSectionCard
                title="Runa (magia vinculada)" tooltip="Só para itens do tipo 'Runa': qual magia é lançada ao usar a runa."
                className="mt-4"
                contentClassName="flex flex-col gap-3"
              >
                <p className="text-sm text-muted-foreground">
                  Selecione uma spell existente para preencher o nome automaticamente, ou digite
                  livremente — o XML sempre usa o texto de <code>runeSpellName</code>.
                </p>
                <EntitySearchCombobox<SpellFormInput & { id: number }>
                  endpoint="/api/admin/spells"
                  value={null}
                  placeholder="Vincular spell..."
                  formatOption={(spell) => `#${spell.id} — ${spell.name} (${spell.kind})`}
                  onSelect={(spell) => {
                    if (spell) form.setValue("runeSpellName", spell.name);
                  }}
                />
                <TextField
                  control={form.control}
                  name="runeSpellName"
                  label="Nome da magia da runa (Rune spell name)"
                  tooltip={FIELD_HELP.runeSpellName}
                />
              </CollapsibleSectionCard>
            </TabsContent>

            <TabsContent value="resist">
              <CollapsibleSectionCard
                title="Absorção % (absorb)" tooltip={ABSORB_TOOLTIP}
              >
                <RecordGridField
                  control={form.control}
                  basePath="absorbPercent"
                  keys={ITEM_ABSORB_KEYS}
                  labels={ELEMENT_LABELS}
                />
              </CollapsibleSectionCard>
              <CollapsibleSectionCard
                title="Absorção de campos % (field absorb)" tooltip={FIELD_ABSORB_TOOLTIP}
                className="mt-4"
              >
                <RecordGridField
                  control={form.control}
                  basePath="fieldAbsorbPercent"
                  keys={ITEM_FIELD_ABSORB_KEYS}
                  labels={ELEMENT_LABELS}
                />
              </CollapsibleSectionCard>
              <CollapsibleSectionCard
                title="Reflexão % (reflect)" tooltip={REFLECT_PERCENT_TOOLTIP}
                className="mt-4"
              >
                <RecordGridField
                  control={form.control}
                  basePath="reflectPercent"
                  keys={ITEM_ABSORB_KEYS}
                  labels={ELEMENT_LABELS}
                />
              </CollapsibleSectionCard>
              <CollapsibleSectionCard
                title="Chance de reflexão % (reflect chance)" tooltip={REFLECT_CHANCE_TOOLTIP}
                className="mt-4"
              >
                <RecordGridField
                  control={form.control}
                  basePath="reflectChance"
                  keys={ITEM_ABSORB_KEYS}
                  labels={ELEMENT_LABELS}
                />
              </CollapsibleSectionCard>
              <CollapsibleSectionCard
                title="Imunidade a condições" tooltip={SUPPRESS_TOOLTIP}
                className="mt-4"
              >
                <BooleanGridField
                  control={form.control}
                  basePath="suppress"
                  keys={ITEM_SUPPRESS_KEYS}
                  labels={SUPPRESS_LABELS}
                  tooltips={Object.fromEntries(
                    ITEM_SUPPRESS_KEYS.map((key) => [key, SUPPRESS_TOOLTIP]),
                  )}
                />
              </CollapsibleSectionCard>
            </TabsContent>

            <TabsContent value="decay">
              <CollapsibleSectionCard
                title="Decay (duração)" tooltip="Faz o item se transformar ou sumir depois de um tempo."
                contentClassName="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                <ItemIdField
                  control={form.control}
                  name="decayTo"
                  label="Decair para (Decay to)"
                  tooltip={FIELD_HELP.decayTo}
                  nullable
                />
                <NumberField control={form.control} name="duration" label="Duração em segundos (Duration)" tooltip={FIELD_HELP.duration} />
                <CheckField control={form.control} name="stopDuration" label="Pausar duração (Stop duration)" tooltip={FIELD_HELP.stopDuration} />
                <CheckField control={form.control} name="showDuration" label="Mostrar duração (Show duration)" tooltip={FIELD_HELP.showDuration} />
              </CollapsibleSectionCard>

              <CollapsibleSectionCard
                title="Transformação" tooltip="Em quais itens este se transforma ao ser equipado, usado, girado ou ao deitar (camas)."
                className="mt-4"
                contentClassName="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                <ItemIdField control={form.control} name="transformTo" label="Transformar ao usar (Transform to)" tooltip={FIELD_HELP.transformTo} nullable />
                <ItemIdField control={form.control} name="transformEquipTo" label="Transformar ao equipar (Transform equip to)" tooltip={FIELD_HELP.transformEquipTo} nullable />
                <ItemIdField control={form.control} name="transformDeEquipTo" label="Transformar ao desequipar (Transform de-equip to)" tooltip={FIELD_HELP.transformDeEquipTo} nullable />
                <ItemIdField control={form.control} name="rotateTo" label="Rotacionar para (Rotate to)" tooltip={FIELD_HELP.rotateTo} nullable />
                <ItemIdField control={form.control} name="maleTransformTo" label="Cama: ocupada por homem (Male transform to)" tooltip={FIELD_HELP.maleTransformTo} nullable />
                <ItemIdField control={form.control} name="femaleTransformTo" label="Cama: ocupada por mulher (Female transform to)" tooltip={FIELD_HELP.femaleTransformTo} nullable />
              </CollapsibleSectionCard>

              <CollapsibleSectionCard
                title="Mudança de andar" tooltip="Para escadas, buracos e rampas: leva o jogador para outro andar ao pisar."
                className="mt-4"
                contentClassName="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                <EnumField
                  control={form.control}
                  name="floorChange"
                  label="Direção (Floor change)"
                  tooltip={FIELD_HELP.floorChange}
                  options={FLOOR_CHANGES}
                  optionLabels={ENUM_LABELS.floorChange}
                />
              </CollapsibleSectionCard>

              <CollapsibleSectionCard
                title="Cargas e exibição" tooltip="Quantidade de usos do item e o que aparece na descrição dele."
                className="mt-4"
                contentClassName="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                <NumberField control={form.control} name="charges" label="Cargas (Charges)" tooltip={FIELD_HELP.charges} />
                <CheckField control={form.control} name="showCharges" label="Mostrar cargas (Show charges)" tooltip={FIELD_HELP.showCharges} />
                <CheckField control={form.control} name="showAttributes" label="Mostrar atributos (Show attributes)" tooltip={FIELD_HELP.showAttributes} />
              </CollapsibleSectionCard>
            </TabsContent>

            <TabsContent value="container">
              <CollapsibleSectionCard
                title="Container" tooltip="Só para itens do tipo 'Container' (mochilas, caixas, bolsas)."
                contentClassName="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                <NumberField control={form.control} name="containerSize" label="Tamanho do container (Container size)" tooltip={FIELD_HELP.containerSize} />
              </CollapsibleSectionCard>
              <CollapsibleSectionCard
                title="Texto" tooltip="Para livros, cartas e placas: se dá para ler e/ou escrever nele."
                className="mt-4"
                contentClassName="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                <CheckField control={form.control} name="readable" label="Legível (Readable)" tooltip={FIELD_HELP.readable} />
                <CheckField control={form.control} name="writeable" label="Escrevível (Writeable)" tooltip={FIELD_HELP.writeable} />
                <NumberField control={form.control} name="maxTextLen" label="Tamanho máximo do texto (Max text length)" tooltip={FIELD_HELP.maxTextLen} />
                <ItemIdField
                  control={form.control}
                  name="writeOnceItemId"
                  label="Vira este item após escrever (Write once item id)"
                  tooltip={FIELD_HELP.writeOnceItemId}
                  nullable
                />
              </CollapsibleSectionCard>
            </TabsContent>

            <TabsContent value="regen">
              <CollapsibleSectionCard
                title="Luz" tooltip="Faz o item iluminar em volta (tochas, lanternas)."
                contentClassName="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                <NumberField control={form.control} name="lightLevel" label="Nível de luz (Light level)" tooltip={FIELD_HELP.lightLevel} />
                <NumberField control={form.control} name="lightColor" label="Cor da luz (Light color)" tooltip={FIELD_HELP.lightColor} />
              </CollapsibleSectionCard>

              <CollapsibleSectionCard
                title="Velocidade e regeneração" tooltip="Efeitos aplicados ao jogador enquanto o item estiver equipado."
                className="mt-4"
                contentClassName="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
              >
                <NumberField control={form.control} name="speed" label="Velocidade (Speed)" tooltip={FIELD_HELP.speed} />
                <NumberField control={form.control} name="healthGain" label="Ganho de vida (Health gain)" tooltip={FIELD_HELP.healthGain} />
                <NumberField control={form.control} name="healthTicks" label="Intervalo de vida (Health ticks)" tooltip={FIELD_HELP.healthTicks} />
                <NumberField control={form.control} name="manaGain" label="Ganho de mana (Mana gain)" tooltip={FIELD_HELP.manaGain} />
                <NumberField control={form.control} name="manaTicks" label="Intervalo de mana (Mana ticks)" tooltip={FIELD_HELP.manaTicks} />
                <CheckField control={form.control} name="manaShield" label="Escudo de mana (Mana shield)" tooltip={FIELD_HELP.manaShield} />
              </CollapsibleSectionCard>

              <CollapsibleSectionCard
                title="Bônus de atributos" tooltip="Aumentam (ou diminuem, se negativos) os atributos do jogador enquanto o item estiver equipado."
                className="mt-4"
                contentClassName="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
              >
                <NumberField control={form.control} name="maxHitPoints" label="Vida máxima (Max HP)" tooltip={FIELD_HELP.maxHitPoints} />
                <NumberField control={form.control} name="maxHitPointsPercent" label="Vida máxima % (Max HP %)" tooltip={FIELD_HELP.maxHitPointsPercent} />
                <NumberField control={form.control} name="maxManaPoints" label="Mana máxima (Max mana)" tooltip={FIELD_HELP.maxManaPoints} />
                <NumberField control={form.control} name="maxManaPointsPercent" label="Mana máxima % (Max mana %)" tooltip={FIELD_HELP.maxManaPointsPercent} />
                <NumberField control={form.control} name="magicLevelPoints" label="Nível mágico (Magic level)" tooltip={FIELD_HELP.magicLevelPoints} />
                <NumberField control={form.control} name="magicLevelPointsPercent" label="Nível mágico % (Magic level %)" tooltip={FIELD_HELP.magicLevelPointsPercent} />
                <NumberField control={form.control} name="soulPoints" label="Pontos de alma (Soul points)" tooltip={FIELD_HELP.soulPoints} />
                <NumberField control={form.control} name="soulPointsPercent" label="Pontos de alma % (Soul points %)" tooltip={FIELD_HELP.soulPointsPercent} />
                <NumberField control={form.control} name="increaseMagicValue" label="Aumento de dano mágico (Increase magic)" tooltip={FIELD_HELP.increaseMagicValue} />
                <NumberField control={form.control} name="increaseMagicPercent" label="Aumento de dano mágico % (Increase magic %)" tooltip={FIELD_HELP.increaseMagicPercent} />
                <NumberField control={form.control} name="increaseHealingValue" label="Aumento de cura (Increase healing)" tooltip={FIELD_HELP.increaseHealingValue} />
                <NumberField control={form.control} name="increaseHealingPercent" label="Aumento de cura % (Increase healing %)" tooltip={FIELD_HELP.increaseHealingPercent} />
              </CollapsibleSectionCard>
            </TabsContent>

            <TabsContent value="field">
              <CollapsibleSectionCard
                title="Campo mágico (só quando o tipo é 'Campo mágico')" tooltip="Configura o dano contínuo de campos como fogo, veneno e energia."
                contentClassName="flex flex-col gap-4"
              >
                <CheckField control={form.control} name="field.enabled" label="Este item tem bloco de campo" tooltip={FIELD_HELP.fieldEnabled} />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <EnumField
                    control={form.control}
                    name="field.value"
                    label="Tipo de dano"
                    tooltip={FIELD_HELP.fieldValue}
                    options={FIELD_TYPES}
                    optionLabels={ENUM_LABELS.fieldType}
                  />
                  <NumberField control={form.control} name="field.ticks" label="Intervalo em ms (Ticks)" tooltip={FIELD_HELP.fieldTicks} />
                  <NumberField control={form.control} name="field.count" label="Repetições (Count)" tooltip={FIELD_HELP.fieldCount} />
                  <NumberField control={form.control} name="field.start" label="Dano inicial (Start)" tooltip={FIELD_HELP.fieldStart} />
                </div>
                <div>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Dano ao longo do tempo (lista de dano)
                  </p>
                  <div className="flex flex-col gap-2">
                    {fieldDamages.fields.map((field, index) => (
                      <div key={field.id} className="grid grid-cols-[1fr_auto] items-center gap-2">
                        <NumberField
                          control={form.control}
                          name={`field.damages.${index}.damage`}
                          label="Dano (Damage)"
                          tooltip={FIELD_HELP.fieldDamage}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="self-end"
                          onClick={() => fieldDamages.remove(index)}
                        >
                          <Trash2 className="size-4 cursor-pointer" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="self-start"
                      onClick={() => fieldDamages.append(emptyFieldDamage)}
                    >
                      <Plus className="size-4 cursor-pointer" />
                      Adicionar dano
                    </Button>
                  </div>
                </div>
              </CollapsibleSectionCard>
            </TabsContent>

            <TabsContent value="flags">
              {FLAG_GROUPS.map((group, index) => (
                <CollapsibleSectionCard
                  key={group.title}
                  title={group.title} tooltip={group.tooltip}
                  className={index > 0 ? "mt-4" : undefined}
                >
                  <BooleanGridField
                    control={form.control}
                    basePath="flags"
                    keys={group.keys}
                    labels={FLAG_LABELS}
                    tooltips={FLAG_TOOLTIPS}
                  />
                </CollapsibleSectionCard>
              ))}
            </TabsContent>

            <TabsContent value="extra">
              <CollapsibleSectionCard
                title="Atributos extras" tooltip="Atributos do items.xml que não têm campo próprio no formulário. Cada linha vira um <attribute key=... value=...> no XML."
                contentClassName="flex flex-col gap-2"
              >
                  <p className="text-sm text-muted-foreground">
                    Atributos <code>{"<attribute key>"}</code> não modelados nas
                    abas acima — usado principalmente para preservar dados
                    importados de um <code>items.xml</code>
                    real sem perda.
                  </p>
                  {extraAttributes.fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="grid grid-cols-[1fr_1fr_auto] items-center gap-2"
                    >
                      <FormField
                        control={form.control}
                        name={`extraAttributes.${index}.key`}
                        render={({ field }) => (
                          <Input {...field} placeholder="chave (key)" />
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`extraAttributes.${index}.value`}
                        render={({ field }) => (
                          <Input {...field} placeholder="valor (value)" />
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => extraAttributes.remove(index)}
                      >
                        <Trash2 className="size-4 cursor-pointer" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="self-start"
                    onClick={() =>
                      extraAttributes.append({ key: "", value: "" })
                    }
                  >
                    <Plus className="size-4 cursor-pointer" />
                    Adicionar atributo
                  </Button>
              </CollapsibleSectionCard>
            </TabsContent>

            <TabsContent value="movements">
              <CollapsibleSectionCard
                title="Movements vinculados" tooltip="Scripts de movimento (ao pisar, equipar, desequipar) já cadastrados para este item."
              >
                  {isEditing ? (
                    <ItemLinkedMovementsPanel itemId={itemId} />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Salve o item primeiro para ver/criar movements vinculados
                      a ele.
                    </p>
                  )}
              </CollapsibleSectionCard>
            </TabsContent>
          </Tabs>

          {mode === "page" && showActionBar && (
            <div className="sticky bottom-4 z-10 rounded-xl border border-border bg-card p-3 shadow-lg ring-1 ring-foreground/5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                nativeButton={false}
                render={<Link href="/admin/items" />}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !canSave}
                className="w-full sm:w-auto"
              >
                {isSubmitting
                  ? "Salvando..."
                  : isEditing
                    ? "Salvar alterações"
                    : "Criar item"}
              </Button>
              </div>
            </div>
          )}
        </form>
      </Form>

      <div className="flex flex-col gap-6 lg:sticky lg:top-6">
        <XmlPreviewCard value={previewXml} />

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Pré-visualização das sprites</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <EntityThumb entityType="item" id={itemId} name={watched.name} size="lg" />
            ) : pendingLooktype ? (
              <LooktypeAnimatedImage
                key={pendingLooktype.id}
                looktypeId={pendingLooktype.id}
                frameCount={pendingLooktype.frameCount}
                frameDurationsMs={pendingLooktype.frameDurationsMs as number[]}
                updatedAt={pendingLooktype.updatedAt}
                size="md"
              />
            ) : pendingImagePreview ? (
              // eslint-disable-next-line @next/next/no-img-element -- preview local do arquivo selecionado, ainda não enviado
              <img
                src={pendingImagePreview}
                alt="Preview"
                className="size-16 rounded-sm border border-border object-contain bg-muted/40"
              />
            ) : (
              
              <p className="text-sm text-muted-foreground">
                Salve o item primeiro para poder enviar/ver a imagem.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {mode === "page" && (
        <ItemConflictDialog
          conflict={pendingConflict}
          cancelLabel={rangeMode ? "Pular este item" : "Cancelar"}
          onResolve={handleConflictResolve}
        />
      )}
    </div>
  );
});
