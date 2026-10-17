"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Mostra só a quantidade; ao passar o mouse lista cada item, um abaixo do outro. Precisa estar
 * dentro de um `TooltipProvider` (a listagem já tem). */
export function CountTooltip({
  entries,
  count = entries.length,
}: {
  entries: { label: string; value: string }[];
  /** Número exibido na célula (padrão: quantidade de linhas). `0` mostra "—". */
  count?: number;
}) {
  if (entries.length === 0 || count === 0) return <>—</>;

  return (
    <Tooltip>
      <TooltipTrigger className="cursor-help underline decoration-dotted underline-offset-2">
        {count}
      </TooltipTrigger>
      <TooltipContent>
        <div className="flex flex-col gap-0.5">
          {entries.map((entry, index) => (
            <div key={`${entry.label}-${index}`}>
              {entry.label}: {entry.value}
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/** Texto curto com o nome em inglês no hover (ex.: tipo de slot/arma). */
export function LabelTooltip({ label, hint }: { label: string; hint: string }) {
  return (
    <Tooltip>
      <TooltipTrigger className="cursor-help underline decoration-dotted underline-offset-2">
        {label}
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}
