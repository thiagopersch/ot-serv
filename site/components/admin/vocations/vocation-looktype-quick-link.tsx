"use client";

import { useState } from "react";
import useSWR from "swr";
import { ImageOff } from "lucide-react";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import { formatLooktypeOption } from "@/lib/validations/admin/looktype";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EntitySearchCombobox } from "@/components/shared/entity-search-combobox";
import { LooktypeAnimatedImage } from "@/components/shared/looktype-animated-image";

type LooktypeRow = {
  id: number;
  name: string;
  looktypeNumber: number | null;
  frameCount: number;
  frameDurationsMs: number[];
  updatedAt: string;
};

/** Ação rápida pra vincular/trocar a sprite (looktype) de uma vocação direto da listagem, sem
 * precisar abrir o form de edição completo — PATCH dedicado em `[id]/looktype/route.ts`. Mesmo
 * combobox usado no form (`EntitySearchCombobox` + `LooktypeAnimatedImage`), dentro de um popover. */
export function VocationLooktypeQuickLink({
  vocationId,
  lookTypeId,
  onLinked,
}: {
  vocationId: number;
  lookTypeId: number | null;
  onLinked: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: selectedData } = useSWR<PaginatedResult<LooktypeRow>>(
    lookTypeId ? `/api/admin/looktypes?id=${lookTypeId}` : null,
    fetcher,
  );
  const selected = selectedData?.data.find((lt) => lt.id === lookTypeId) ?? null;

  async function handleSelect(lookTypeId: number | null) {
    setIsSubmitting(true);

    const response = await fetch(`/api/admin/vocations/${vocationId}/looktype`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lookTypeId }),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      toast.error("Não foi possível vincular a sprite.");
      return;
    }

    toast.success(lookTypeId ? "Sprite vinculada." : "Sprite desvinculada.");
    setOpen(false);
    onLinked();
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="sm" className="gap-2 px-1.5">
            {selected ? (
              <LooktypeAnimatedImage
                key={selected.id}
                looktypeId={selected.id}
                frameCount={selected.frameCount}
                frameDurationsMs={selected.frameDurationsMs}
                updatedAt={selected.updatedAt}
                size="sm"
              />
            ) : (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-dashed border-border text-muted-foreground">
                <ImageOff className="size-3.5" />
              </span>
            )}
          </Button>
        }
      />
      <PopoverContent className="w-72">
        <div className="flex flex-col gap-2 p-1">
          <span className="text-xs font-medium text-muted-foreground">Vincular sprite (looktype)</span>
          <EntitySearchCombobox<LooktypeRow>
            endpoint="/api/admin/looktypes"
            value={lookTypeId}
            placeholder="Buscar looktype..."
            formatOption={(lt) => formatLooktypeOption(lt)}
            renderOption={(lt) => (
              <span className="flex items-center gap-2">
                <LooktypeAnimatedImage
                  key={lt.id}
                  looktypeId={lt.id}
                  frameCount={lt.frameCount}
                  frameDurationsMs={lt.frameDurationsMs}
                  updatedAt={lt.updatedAt}
                  size="sm"
                />
                {formatLooktypeOption(lt)}
              </span>
            )}
            onSelect={(lt) => handleSelect(lt?.id ?? null)}
          />
          {isSubmitting && <span className="text-xs text-muted-foreground">Salvando...</span>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
