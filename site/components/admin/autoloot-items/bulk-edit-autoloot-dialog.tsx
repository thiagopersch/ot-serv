"use client";

import { useState } from "react";
import { toast } from "sonner";

import {
  AUTOLOOT_CATEGORIES,
  AUTOLOOT_CATEGORY_LABELS,
} from "@/lib/validations/admin/autoloot-item";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Valor sentinela "não alterar" dos dois selects. */
const KEEP = "__keep__";
/** Valor sentinela do tipo automático (`category = ""`). */
const AUTO = "auto";

const CATEGORY_OPTIONS = [
  { value: KEEP, label: "Manter atual" },
  { value: AUTO, label: "Automático (items.xml)" },
  ...AUTOLOOT_CATEGORIES.map((category) => ({
    value: category,
    label: AUTOLOOT_CATEGORY_LABELS[category],
  })),
];

const PUBLISHED_OPTIONS = [
  { value: KEEP, label: "Manter atual" },
  { value: "true", label: "Sim" },
  { value: "false", label: "Não" },
];

function OptionSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={(next) => onChange(next ?? KEEP)}>
        <SelectTrigger className="w-full">
          <SelectValue>
            {(current: string | null) =>
              options.find((option) => option.value === current)?.label ?? current
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

type BulkEditAutolootDialogProps = {
  ids: number[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado após salvar — o caller dá `mutate()` e limpa a seleção. */
  onSaved: () => void;
};

/** Altera Tipo e/ou Publicado de todos os itens do autoloot selecionados de uma vez. */
export function BulkEditAutolootDialog({
  ids,
  open,
  onOpenChange,
  onSaved,
}: BulkEditAutolootDialogProps) {
  const [category, setCategory] = useState(KEEP);
  const [published, setPublished] = useState(KEEP);
  const [saving, setSaving] = useState(false);

  const nothingToChange = category === KEEP && published === KEEP;

  function handleOpenChange(next: boolean) {
    if (!next) {
      setCategory(KEEP);
      setPublished(KEEP);
    }
    onOpenChange(next);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/autoloot-items/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids,
          ...(category !== KEEP ? { category: category === AUTO ? "" : category } : {}),
          ...(published !== KEEP ? { published: published === "true" } : {}),
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        updatedCount?: number;
        error?: string;
      } | null;

      if (!response.ok) {
        toast.error(body?.error ?? "Não foi possível salvar as alterações.");
        return;
      }

      toast.success(`${body?.updatedCount ?? ids.length} item(ns) atualizado(s).`);
      onSaved();
      handleOpenChange(false);
    } catch {
      toast.error("Falha de rede ao salvar as alterações.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar selecionados em massa</DialogTitle>
          <DialogDescription>
            Aplica o tipo e/ou o status de publicação aos {ids.length} item(ns) selecionado(s).
            Campos em &quot;Manter atual&quot; não são alterados.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <OptionSelect
            label="Tipo"
            value={category}
            options={CATEGORY_OPTIONS}
            onChange={setCategory}
          />
          <OptionSelect
            label="Publicado"
            value={published}
            options={PUBLISHED_OPTIONS}
            onChange={setPublished}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => handleOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" disabled={saving || nothingToChange} onClick={handleSave}>
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
