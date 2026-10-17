"use client";

import useSWR from "swr";
import dayjs from "dayjs";
import { ChevronDown } from "lucide-react";

import { fetcher } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleTrigger, CollapsiblePanel } from "@/components/ui/collapsible";
import type { CombatData, FragEntry } from "../types";

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between border-b py-2 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function FragList({ frags, justified }: { frags: FragEntry[]; justified: boolean }) {
  if (frags.length === 0) {
    return <p className="py-3 text-sm text-muted-foreground">Nenhum frag registrado.</p>;
  }

  return (
    <div className="flex flex-col gap-2 py-2">
      {frags.map((frag, index) => {
        const pronoun = frag.victimSex === 2 ? "She" : "He";
        return (
          <div key={index} className="flex flex-col gap-1 rounded-md border p-2 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span>
              <span className="text-xs text-muted-foreground">
                {dayjs.unix(frag.date).format("DD MMM YYYY, HH:mm")}
              </span>{" "}
              — {pronoun} fragged {frag.victimName} at level {frag.victimLevel}, reset {frag.victimResets}.
            </span>
            <Badge
              className={cn(justified ? "bg-green-600 text-white" : "")}
              variant={justified ? "default" : "destructive"}
            >
              {justified ? "Justificado" : "Não justificado"}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}

function FragCollapsible({ title, frags, justified }: { title: string; frags: FragEntry[]; justified: boolean }) {
  return (
    <Collapsible defaultOpen={false}>
      <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm font-medium">
        {title} ({frags.length})
        <ChevronDown className="size-4 transition-transform group-data-open:rotate-180" />
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <FragList frags={frags} justified={justified} />
      </CollapsiblePanel>
    </Collapsible>
  );
}

export function CombatTab({ name }: { name: string }) {
  const { data } = useSWR<CombatData>(`/api/public/characters/${encodeURIComponent(name)}/combat`, fetcher);

  if (!data) return null;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Combate e PVP</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col">
          <InfoRow label="Frags injustos nos últimos 7 dias" value={data.fragCounts.last7} />
          <InfoRow label="Frags injustos nos últimos 15 dias" value={data.fragCounts.last15} />
          <InfoRow label="Frags injustos nos últimos 30 dias" value={data.fragCounts.last30} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kills / Mortes</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col">
          <InfoRow label="Kills" value={data.totalKills} />
          <InfoRow label="Mortes" value={data.totalDeaths} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Frags</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <FragCollapsible title="Frags justificados" frags={data.justifiedFrags} justified />
          <FragCollapsible title="Frags não justificados" frags={data.unjustifiedFrags} justified={false} />
        </CardContent>
      </Card>
    </div>
  );
}
