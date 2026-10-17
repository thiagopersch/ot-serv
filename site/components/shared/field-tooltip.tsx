"use client";

import { CircleHelp } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/** Ícone de ajuda para colocar ao lado de um `FormLabel`, com o texto explicando o que aquele
 * campo faz no servidor C++ (ou outra orientação de preenchimento). */
export function FieldTooltip({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <button type="button" tabIndex={-1} className="cursor-help text-muted-foreground hover:text-foreground">
              <CircleHelp className="size-3.5" />
            </button>
          }
        />
        <TooltipContent className="max-w-xs">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
