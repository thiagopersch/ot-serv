"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewTab } from "./tabs/overview-tab";
import { EquipmentTab } from "./tabs/equipment-tab";
import { CombatTab } from "./tabs/combat-tab";
import { JourneyTab } from "./tabs/journey-tab";
import { AccountTab } from "./tabs/account-tab";
import type { CharacterDetail } from "./types";

export function CharacterProfileTabs({ name, player }: { name: string; player: CharacterDetail }) {
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Visão geral</TabsTrigger>
        <TabsTrigger value="equipment">Equipamento</TabsTrigger>
        <TabsTrigger value="combat">Combate</TabsTrigger>
        <TabsTrigger value="journey">Jornada</TabsTrigger>
        <TabsTrigger value="account">Conta</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <OverviewTab player={player} />
      </TabsContent>
      <TabsContent value="equipment">
        <EquipmentTab name={name} player={player} />
      </TabsContent>
      <TabsContent value="combat">
        <CombatTab name={name} />
      </TabsContent>
      <TabsContent value="journey">
        <JourneyTab name={name} />
      </TabsContent>
      <TabsContent value="account">
        <AccountTab player={player} />
      </TabsContent>
    </Tabs>
  );
}
