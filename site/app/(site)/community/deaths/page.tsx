"use client";

import Link from "next/link";
import useSWR from "swr";
import dayjs from "dayjs";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import { fetcher } from "@/lib/fetcher";
import { PAGE_SIZE_OPTIONS, type PaginatedResult } from "@/lib/pagination";
import { useServerTable } from "@/hooks/use-server-table";
import type { EntityImageInfo } from "@/components/shared/use-entity-images";
import { EntityThumb } from "@/components/shared/entity-thumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Death = {
  id: number;
  date: number;
  level: number;
  playerName: string;
  killers: { name: string; type: "player" | "monster" }[];
  details: {
    blessed: boolean;
    blessings: number;
    levelBefore: number;
    levelAfter: number | null;
  } | null;
  items: { itemId: number; count: number; name: string; image: EntityImageInfo | null }[];
};

function DeathCard({ death }: { death: Death }) {
  const { details } = death;
  const levelBefore = details?.levelBefore || death.level;
  const levelAfter = details?.levelAfter ?? null;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Link
            href={`/community/characters/${encodeURIComponent(death.playerName)}`}
            className="hover:underline"
          >
            {death.playerName}
          </Link>
          {details &&
            (details.blessed ? (
              <Badge className="bg-green-600/15 text-green-600 dark:text-green-400">com bless</Badge>
            ) : (
              <Badge variant="destructive">sem bless</Badge>
            ))}
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {dayjs.unix(death.date).format("DD/MM/YYYY HH:mm:ss")}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <p>
          {levelAfter != null ? `Level ${levelBefore} → ${levelAfter}` : `Level ${levelBefore}`}
        </p>
        <p>
          <span className="text-muted-foreground">Morreu para: </span>
          {death.killers.length
            ? death.killers.map((killer, index) => (
                <span key={`${killer.type}:${killer.name}`}>
                  {index > 0 && ", "}
                  <span
                    className={killer.type === "player" ? "text-red-500" : "text-orange-400"}
                  >
                    {killer.name}
                  </span>
                </span>
              ))
            : "—"}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-muted-foreground">Perdeu:</span>
          {!details ? (
            <span className="text-muted-foreground italic">sem registro</span>
          ) : death.items.length === 0 ? (
            <span className="text-muted-foreground italic">nenhum item</span>
          ) : (
            death.items.map((item, index) => (
              <span key={`${item.itemId}-${index}`} className="inline-flex items-center gap-1.5">
                <EntityThumb
                  entityType="item"
                  id={item.itemId}
                  name={item.name}
                  image={item.image}
                />
                <span>
                  {item.count > 1 ? `${item.count}x ` : ""}
                  {item.name}
                </span>
              </span>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DeathsPage() {
  const table = useServerTable();

  const { data, isLoading } = useSWR<PaginatedResult<Death>>(
    `/api/public/deaths?${table.buildQueryParams().toString()}`,
    fetcher,
  );

  const pageCount = data?.pageCount ?? 1;
  const canPrevious = table.pageIndex > 0;
  const canNext = table.pageIndex < pageCount - 1;
  const deaths = data?.data ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Últimas mortes</h1>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Buscar jogador..."
            value={table.searchInput}
            onChange={(event) => table.handleSearchChange(event.target.value)}
            className="max-w-xs"
          />
          <div className="ml-auto">
            <Select
              value={String(table.pageSize)}
              onValueChange={(value) => value && table.setPageSize(Number(value))}
            >
              <SelectTrigger className="w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size} / página
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 w-full" />
          ))
        ) : deaths.length ? (
          deaths.map((death) => <DeathCard key={death.id} death={death} />)
        ) : (
          <p className="py-12 text-center text-muted-foreground">Nenhuma morte encontrada.</p>
        )}

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Página {table.pageIndex + 1} de {pageCount}
            {data?.total != null ? ` — ${data.total} registro(s)` : ""}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(0)}
              disabled={!canPrevious}
              title="Primeira página"
            >
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(table.pageIndex - 1)}
              disabled={!canPrevious}
              title="Página anterior"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(table.pageIndex + 1)}
              disabled={!canNext}
              title="Próxima página"
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(pageCount - 1)}
              disabled={!canNext}
              title="Última página"
            >
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
