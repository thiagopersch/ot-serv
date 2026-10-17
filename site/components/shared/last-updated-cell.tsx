"use client";

import dayjs from "dayjs";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type LastUpdatedCellProps = {
  /** Data da última atualização do registro (`updatedAt`), como ISO string ou `Date`. */
  date: string | Date;
};

type RelativeLabel = { text: string; isNew: boolean };

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function relativeLabel(date: Date, now: Date): RelativeLabel {
  const diffMinutes = (now.getTime() - date.getTime()) / 60_000;
  if (diffMinutes < 1) return { text: "Novo", isNew: true };

  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (dayDiff <= 0) return { text: "Hoje", isNew: false };
  if (dayDiff === 1) return { text: "Ontem", isNew: false };

  if (dayDiff < 365) {
    return { text: `${dayDiff} dia${dayDiff === 1 ? "" : "s"} atrás`, isNew: false };
  }

  const years = Math.floor(dayDiff / 365);
  return { text: `${years} ano${years === 1 ? "" : "s"} atrás`, isNew: false };
}

/** Célula "Última atualização": badge verde "Novo" (< 1 min), senão texto relativo
 * (Hoje/Ontem/N dias/N anos) com tooltip mostrando data e hora completas. */
export function LastUpdatedCell({ date }: LastUpdatedCellProps) {
  const value = typeof date === "string" ? new Date(date) : date;
  const { text, isNew } = relativeLabel(value, new Date());
  const formatted = dayjs(value).format("DD/MM/YYYY [às] HH:mm");

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="cursor-default">
          {isNew ? (
            <Badge className="border-transparent bg-green-600 text-white dark:bg-green-500">{text}</Badge>
          ) : (
            <span className="text-muted-foreground">{text}</span>
          )}
        </TooltipTrigger>
        <TooltipContent>{formatted}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
