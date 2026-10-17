import dayjs from "dayjs";

import { Card, CardContent } from "@/components/ui/card";
import type { CharacterDetail } from "../types";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b py-2 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function OverviewTab({ player }: { player: CharacterDetail }) {
  const createdAt = dayjs(player.createdAt);
  const daysSinceCreation = dayjs().diff(createdAt, "day");
  const lastSeen = player.lastlogin ? dayjs.unix(player.lastlogin) : null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-1 pt-6">
        <InfoRow label="Cidade" value={player.townName} />
        <InfoRow label="Idade" value={`${player.age} anos`} />
        <InfoRow label="Criado em" value={createdAt.format("DD/MM/YYYY [às] HH:mm")} />
        <InfoRow label="Existe há" value={`${daysSinceCreation} dias`} />
        <InfoRow label="Visto por último" value={lastSeen ? lastSeen.format("DD/MM/YYYY [às] HH:mm") : "—"} />
      </CardContent>
    </Card>
  );
}
