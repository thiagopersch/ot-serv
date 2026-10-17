"use client";

import { ChevronDown } from "lucide-react";
import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import { Collapsible, CollapsibleTrigger, CollapsiblePanel } from "@/components/ui/collapsible";

type UsageEntry = { id: number; name: string };

type UsageResponse = {
  npcs: UsageEntry[];
  vocations: UsageEntry[];
  monsters: UsageEntry[];
  items: UsageEntry[];
  spells: UsageEntry[];
  outfits?: UsageEntry[];
  extOutfits?: UsageEntry[];
  total: number;
};

function UsageGroup({ label, entries = [] }: { label: string; entries?: UsageEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">
        {label} ({entries.length})
      </p>
      <ul className="ml-4 list-disc text-sm">
        {entries.map((entry) => (
          <li key={entry.id}>{entry.name}</li>
        ))}
      </ul>
    </div>
  );
}

export function LooktypeUsagePanel({ looktypeId }: { looktypeId: number }) {
  const { data, isLoading } = useSWR<UsageResponse>(`/api/admin/looktypes/${looktypeId}/usage`, fetcher);

  return (
    <Collapsible defaultOpen className="rounded-md border p-3">
      <CollapsibleTrigger className="text-sm font-medium">
        <ChevronDown className="size-4" />
        Vinculado em {data ? `(${data.total})` : ""}
      </CollapsibleTrigger>
      <CollapsiblePanel>
        {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {data && data.total === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum cadastro usa essa sprite ainda.</p>
        )}
        {data && (
          <div className="flex flex-col gap-2">
            <UsageGroup label="NPCs" entries={data.npcs} />
            <UsageGroup label="Vocações" entries={data.vocations} />
            <UsageGroup label="Monstros" entries={data.monsters} />
            <UsageGroup label="Items" entries={data.items} />
            <UsageGroup label="Spells" entries={data.spells} />
            <UsageGroup label="Outfits (outfits.xml)" entries={data.outfits} />
            <UsageGroup label="Extoutfits (extoutfits.xml)" entries={data.extOutfits} />
          </div>
        )}
      </CollapsiblePanel>
    </Collapsible>
  );
}
