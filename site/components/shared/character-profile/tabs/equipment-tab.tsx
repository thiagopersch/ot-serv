"use client";

import useSWR from "swr";
import { Info } from "lucide-react";

import { fetcher } from "@/lib/fetcher";
import { SKILL_DISPLAYS } from "@/lib/skill-names";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TibiaEquipmentPanel } from "@/components/shared/tibia-equipment-panel";
import { HpManaBar } from "../hp-mana-bar";
import type { CharacterDetail, SkillsData } from "../types";

export function EquipmentTab({ name, player }: { name: string; player: CharacterDetail }) {
  const { data } = useSWR<SkillsData>(`/api/public/characters/${encodeURIComponent(name)}/skills`, fetcher);

  const valueByKey: Record<string, number> = {
    ...(data?.skills ?? {}),
    magic: data?.magic ?? 0,
    attackspeed: data?.attackSpeed ?? 0,
    dodge: data?.dodge ?? 0,
    critical: data?.critical ?? 0,
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="pt-6">
          <HpManaBar health={player.health} healthmax={player.healthmax} mana={player.mana} manamax={player.manamax} />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <Card className="w-fit">
          <CardHeader>
            <CardTitle>Arsenal</CardTitle>
          </CardHeader>
          <CardContent>
            <TibiaEquipmentPanel equipment={player.equipment} cap={player.cap} soul={player.soul} />
          </CardContent>
        </Card>

        <Card className="flex-1">
          <CardHeader>
            <CardTitle>Habilidades</CardTitle>
          </CardHeader>
          <CardContent>
            <TooltipProvider>
              <div className="flex flex-col">
                {SKILL_DISPLAYS.map(({ key, labelPt, labelEn }) => {
                  const value = valueByKey[key] ?? 0;
                  const isCapped = key === "dodge" || key === "critical";
                  const cap = key === "dodge" ? data?.dodgeCap : key === "critical" ? data?.criticalCap : undefined;

                  return (
                    <div key={key} className="flex items-center justify-between border-b py-2 text-sm last:border-b-0">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        {labelPt}
                        <Tooltip>
                          <TooltipTrigger render={<Info className="size-3.5 cursor-help" />} />
                          <TooltipContent>{labelEn}</TooltipContent>
                        </Tooltip>
                      </span>
                      <span>{isCapped && cap ? `${value}/${cap}` : value}</span>
                    </div>
                  );
                })}
              </div>
            </TooltipProvider>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
