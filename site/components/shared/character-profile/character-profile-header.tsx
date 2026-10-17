import { entityImageUrl } from "@/lib/entity-image";
import { Badge } from "@/components/ui/badge";
import type { CharacterDetail } from "./types";

function VocationPortrait({
  name,
  vocationId,
  image,
}: {
  name: string;
  vocationId: number;
  image: CharacterDetail["vocationImage"];
}) {
  const src = image
    ? entityImageUrl("vocation", vocationId, image.extension, new Date(image.updatedAt))
    : null;

  return (
    <div
      className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border-2"
      style={{
        borderTopColor: "#7a7a7a",
        borderLeftColor: "#7a7a7a",
        borderRightColor: "#0d0d0d",
        borderBottomColor: "#0d0d0d",
        background: "linear-gradient(180deg, #2e2e2e 0%, #1c1c1c 100%)",
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- sprite pequeno, sem otimização necessária
        <img src={src} alt={name} className="size-full object-contain" style={{ imageRendering: "pixelated" }} />
      ) : (
        <span className="text-xs text-zinc-500">{name.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

export function CharacterProfileHeader({ player }: { player: CharacterDetail }) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:flex-row sm:items-center">
      <VocationPortrait name={player.vocationName} vocationId={player.vocation} image={player.vocationImage} />

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">{player.name}</h1>
          <Badge variant={player.online ? "default" : "secondary"}>
            {player.online ? "Online" : "Offline"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{player.vocationName}</p>
        {player.guild && (
          <p className="text-xs text-muted-foreground">
            {player.guild.name} ({player.guild.rank})
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <div className="flex flex-col items-center rounded-md border px-3 py-2">
          <span className="text-muted-foreground">Rank Level</span>
          <span className="text-base font-semibold">#{player.rankPositionLevel}</span>
        </div>
        {player.accountGroupId === 6 && (
          <div className="flex flex-col items-center rounded-md border px-3 py-2">
            <span className="text-muted-foreground">Doações</span>
            <span className="text-base font-semibold">{player.donationCount}</span>
          </div>
        )}
        <div className="flex flex-col items-center rounded-md border px-3 py-2">
          <span className="text-muted-foreground">Rank Resets</span>
          <span className="text-base font-semibold">#{player.rankPositionResets}</span>
        </div>
        <div className="flex flex-col items-center rounded-md border px-3 py-2">
          <span className="text-muted-foreground">Média</span>
          <span className="text-base font-semibold">{player.resetAverage ?? "—"}</span>
        </div>
      </div>
    </div>
  );
}
