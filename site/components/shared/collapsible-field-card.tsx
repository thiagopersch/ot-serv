"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleTrigger, CollapsiblePanel } from "@/components/ui/collapsible";

type CollapsibleFieldCardProps = {
  /** Título exibido no gatilho de expandir/minimizar (ex.: "Composite #1"). */
  title: ReactNode;
  onRemove: () => void;
  /** Conteúdo extra no cabeçalho, à esquerda do botão de remover (ex.: um `<Select>` de tipo). */
  headerExtra?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * Card colapsável usada pelas listas de "segmentos" repetíveis do conteúdo de
 * Doodad/Wall/Ground (composites, alternates, tiles, segmentos de parede/mesa, portas,
 * friends, borders) — cada entrada pode ser minimizada individualmente para não deixar a
 * aba "Conteúdo" excessivamente longa quando há muitas entradas cadastradas.
 */
export function CollapsibleFieldCard({
  title,
  onRemove,
  headerExtra,
  defaultOpen = true,
  className,
  children,
}: CollapsibleFieldCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className={className}>
      <CardContent className="flex flex-col gap-3 py-3">
        <Collapsible open={open} onOpenChange={setOpen}>
          <div className="flex items-center justify-between gap-2">
            <CollapsibleTrigger>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 data-panel-open:rotate-180" />
              <span className="text-xs font-medium text-muted-foreground">{title}</span>
            </CollapsibleTrigger>
            <div className="flex items-center gap-2">
              {headerExtra}
              <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
          <CollapsiblePanel>{children}</CollapsiblePanel>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
