"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  monsterBoostSchema,
  type MonsterBoostInput,
} from "@/lib/validations/admin/monster-boost";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { NumberField } from "@/components/shared/number-field";
import { EntitySearchCombobox } from "@/components/shared/entity-search-combobox";
import { LooktypeThumbById } from "@/components/shared/looktype-thumb-by-id";

type MonsterBoostFormDialogProps = {
  trigger: React.ReactNode;
  title: string;
  defaultValues: MonsterBoostInput;
  /** Id do monstro já resolvido pelo caller (edição) — pré-preenche a thumbnail. */
  initialMonsterId?: number | null;
  /** Looktype vinculada ao monstro já resolvido (edição) — pré-preenche a sprite ao lado do select. */
  initialMonsterLookTypeId?: number | null;
  onSubmit: (values: MonsterBoostInput) => Promise<boolean>;
  successMessage: string;
};

export function MonsterBoostFormDialog({
  trigger,
  title,
  defaultValues,
  initialMonsterId = null,
  initialMonsterLookTypeId = null,
  onSubmit,
  successMessage,
}: MonsterBoostFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [monsterId, setMonsterId] = useState<number | null>(initialMonsterId);
  const [monsterLookTypeId, setMonsterLookTypeId] = useState<number | null>(initialMonsterLookTypeId);

  const form = useForm<MonsterBoostInput, unknown, MonsterBoostInput>({
    resolver: zodResolver(monsterBoostSchema),
    defaultValues,
  });

  function handleOpenChange(next: boolean) {
    if (next) {
      form.reset(defaultValues);
      setMonsterId(initialMonsterId);
      setMonsterLookTypeId(initialMonsterLookTypeId);
    }
    setOpen(next);
  }

  async function handleSubmit(values: MonsterBoostInput) {
    setIsSubmitting(true);
    const ok = await onSubmit(values);
    setIsSubmitting(false);

    if (!ok) {
      toast.error("Não foi possível salvar.");
      return;
    }

    toast.success(successMessage);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex flex-col gap-4"
          >
            <FormItem>
              <FormLabel>Monstro (Monster)</FormLabel>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <EntitySearchCombobox<{ id: number; name: string; lookTypeId: number | null }>
                    endpoint="/api/admin/monsters"
                    value={monsterId}
                    placeholder="Buscar monstro..."
                    formatOption={(monster) => monster.name}
                    renderOption={(monster) => (
                      <span className="flex items-center gap-2">
                        {monster.lookTypeId != null && (
                          <LooktypeThumbById looktypeId={monster.lookTypeId} size="sm" />
                        )}
                        {monster.name}
                      </span>
                    )}
                    onSelect={(monster) => {
                      setMonsterId(monster?.id ?? null);
                      setMonsterLookTypeId(monster?.lookTypeId ?? null);
                      form.setValue("monster", monster?.name ?? "");
                    }}
                  />
                </div>
                {monsterLookTypeId != null && (
                  <LooktypeThumbById looktypeId={monsterLookTypeId} size="md" />
                )}
              </div>
            </FormItem>
            <FormField
              control={form.control}
              name="monster"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <input type="hidden" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <NumberField
              control={form.control}
              name="loot"
              label="Multiplicador de loot (Loot)"
            />
            <NumberField
              control={form.control}
              name="exp"
              label="Multiplicador de experiência (Exp)"
            />
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
