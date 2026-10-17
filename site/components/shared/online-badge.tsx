"use client";

import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type ServerStatus = { online: boolean; onlineCount: number };

/** Verde com >=1 jogador online, branco com servidor de pé e 0 jogadores, vermelho quando o
 * processo do OTServer não responde na porta de login (ver lib/game-server-status.ts). */
export function OnlineBadge() {
  const { data } = useSWR<ServerStatus>("/api/public/server-status", fetcher, {
    refreshInterval: 30_000,
  });

  if (!data) return null;

  const { online, onlineCount } = data;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 font-medium",
        !online && "border-red-500/40 bg-red-500/10 text-red-500",
        online && onlineCount === 0 && "border-border bg-background text-foreground",
        online && onlineCount >= 1 && "border-green-500/40 bg-green-500/10 text-green-500",
      )}
      title={!online ? "Servidor fechado" : `${onlineCount} jogador(es) online`}
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          !online && "bg-red-500",
          online && onlineCount === 0 && "bg-foreground/60",
          online && onlineCount >= 1 && "bg-green-500",
        )}
      />
      {!online ? "Servidor fechado" : `${onlineCount} online`}
    </Badge>
  );
}
