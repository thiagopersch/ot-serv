"use client";

import { useEffect, useState } from "react";
import { Backpack } from "lucide-react";

import { entityImageUrl } from "@/lib/entity-image";
import { looktypeFrameUrl } from "@/lib/looktype-storage";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type EquipmentSlotItem = {
  itemId: number;
  name: string;
  description: string;
  weight: number;
  skills: Record<string, number>;
  image: { extension: string; updatedAt: string } | null;
  looktype: { id: number; frameCount: number; frameDurationsMs: number[]; updatedAt: string } | null;
} | null;

export type Equipment = {
  head: EquipmentSlotItem;
  necklace: EquipmentSlotItem;
  backpack: EquipmentSlotItem;
  armor: EquipmentSlotItem;
  rightHand: EquipmentSlotItem;
  leftHand: EquipmentSlotItem;
  legs: EquipmentSlotItem;
  feet: EquipmentSlotItem;
  ring: EquipmentSlotItem;
  ammo: EquipmentSlotItem;
};

const SKILL_LABELS: Record<string, string> = {
  sword: "Espada",
  axe: "Machado",
  club: "Maça",
  distance: "Distância",
  shielding: "Escudo",
  fishing: "Pesca",
  fist: "Punho",
};

/** Layout fixo do paperdoll (3 colunas): colar/capacete/mochila, arma/armadura/escudo,
 * anel/calça/munição (mesma linha) e bota embaixo da calça. `null` marca uma célula vazia. */
const GRID: ({ key: keyof Equipment; placeholder: string } | null)[][] = [
  [
    { key: "necklace", placeholder: "/slots/neck.png" },
    { key: "head", placeholder: "/slots/head.png" },
    { key: "backpack", placeholder: "/slots/back.png" },
  ],
  [
    { key: "leftHand", placeholder: "/slots/left-hand.png" },
    { key: "armor", placeholder: "/slots/body.png" },
    { key: "rightHand", placeholder: "/slots/right-hand.png" },
  ],
  [
    { key: "ring", placeholder: "/slots/finger.png" },
    { key: "legs", placeholder: "/slots/legs.png" },
    { key: "ammo", placeholder: "/slots/ammo.png" },
  ],
  [null, { key: "feet", placeholder: "/slots/feet.png" }, null],
];

function formatCapacity(value: number): string {
  if (value >= 10_000) return `${Math.round(value / 1000)}k`;
  if (value > 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(value);
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex h-14 w-20 flex-col items-center justify-center gap-0.5 rounded-sm border-2 text-white"
      style={{
        borderTopColor: "#6b6b6b",
        borderLeftColor: "#6b6b6b",
        borderRightColor: "#1a1a1a",
        borderBottomColor: "#1a1a1a",
        background: "linear-gradient(180deg, #3a3a3a 0%, #262626 100%)",
      }}
    >
      <span className="text-[10px] uppercase tracking-wide text-zinc-400">
        {label}
      </span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

type LooktypeInfo = NonNullable<EquipmentSlotItem>["looktype"];

/** Cicla os frames da looktype (mesma lógica de `LooktypeAnimatedImage`, sem o tooltip próprio
 * dele — este slot já tem seu próprio tooltip com nome/peso/skills do item). */
function useLooktypeFrame(looktype: LooktypeInfo) {
  const [frameIndex, setFrameIndex] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the looktype identity changes, not every tick
  useEffect(() => {
    setFrameIndex(0);
  }, [looktype?.id]);

  useEffect(() => {
    if (!looktype || looktype.frameCount <= 1) return;

    const duration = Math.min(looktype.frameDurationsMs[frameIndex] || 100, 1000);
    const timeout = setTimeout(() => {
      setFrameIndex((current) => (current + 1) % looktype.frameCount);
    }, duration);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameIndex, looktype?.id, looktype?.frameCount]);

  return frameIndex;
}

function EquipmentSlot({
  item,
  placeholder,
}: {
  item: EquipmentSlotItem;
  placeholder: string;
}) {
  const frameIndex = useLooktypeFrame(item?.looktype ?? null);

  const imageSrc = item?.looktype
    ? looktypeFrameUrl(item.looktype.id, frameIndex, new Date(item.looktype.updatedAt))
    : item?.image
      ? entityImageUrl(
          "item",
          item.itemId,
          item.image.extension,
          new Date(item.image.updatedAt),
        )
      : placeholder;

  const skillEntries = item ? Object.entries(item.skills) : [];

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            className="group relative flex size-10 shrink-0 items-center justify-center rounded-sm border-2 transition-shadow"
            style={{
              borderTopColor: "#6b6b6b",
              borderLeftColor: "#6b6b6b",
              borderRightColor: "#1a1a1a",
              borderBottomColor: "#1a1a1a",
              background: "linear-gradient(180deg, #3a3a3a 0%, #262626 100%)",
            }}
          />
        }
      >
        <div className="pointer-events-none absolute inset-0.5 flex items-center justify-center rounded-[1px] transition-shadow group-hover:shadow-[0_0_6px_2px_rgba(255,255,255,0.35)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- sprite/placeholder pequeno, sem otimização necessária */}
          <img
            src={imageSrc}
            alt={item?.name ?? ""}
            className="size-8 object-contain"
            style={{ imageRendering: "pixelated", opacity: item ? 1 : 0.6 }}
          />
        </div>
      </TooltipTrigger>
      {item && (
        <TooltipContent>
          <div className="flex max-w-56 flex-col gap-1">
            <span className="font-semibold">{item.name}</span>
            <span className="text-xs text-muted-foreground">
              Peso: {item.weight / 100} oz
            </span>
            {skillEntries.length > 0 && (
              <div className="flex flex-col">
                {skillEntries.map(([key, value]) => (
                  <span key={key} className="text-xs">
                    {SKILL_LABELS[key] ?? key}:{" "}
                    {value > 0 ? `+${value}` : value}
                  </span>
                ))}
              </div>
            )}
            {item.description && (
              <span className="text-xs italic text-muted-foreground">
                {item.description}
              </span>
            )}
          </div>
        </TooltipContent>
      )}
    </Tooltip>
  );
}

/** Painel de inventário no estilo clássico Tibia 8.x — paperdoll fixo (3 colunas) com
 * bordas em bevel metálico, slots 32x32, placeholders em tons de cinza de `public/slots`
 * para posições vazias, e caixas de Capacidade/Soul abaixo. */
export function TibiaEquipmentPanel({
  equipment,
  cap,
  soul,
}: {
  equipment: Equipment;
  cap: number;
  soul: number;
}) {
  return (
    <TooltipProvider>
      <div
        className="w-fit rounded-md border-2 p-3"
        style={{
          borderTopColor: "#7a7a7a",
          borderLeftColor: "#7a7a7a",
          borderRightColor: "#0d0d0d",
          borderBottomColor: "#0d0d0d",
          background: "linear-gradient(180deg, #2e2e2e 0%, #1c1c1c 100%)",
        }}
      >
        <div className="mb-2 flex items-center gap-1.5 border-b border-black/40 pb-1.5 text-xs font-semibold text-zinc-300">
          <Backpack className="size-3.5" />
          Inventory
        </div>

        <div className="flex flex-col gap-1">
          {GRID.map((row, rowIndex) => (
            <div key={rowIndex} className="flex gap-1">
              {row.map((cell, cellIndex) =>
                cell ? (
                  <EquipmentSlot
                    key={cell.key}
                    item={equipment[cell.key]}
                    placeholder={cell.placeholder}
                  />
                ) : (
                  <div key={cellIndex} className="size-10 shrink-0" />
                ),
              )}
            </div>
          ))}
        </div>

        <div className="mt-3 flex gap-2 border-t border-black/40 pt-3">
          <InfoBox label="Cap" value={formatCapacity(cap)} />
          <InfoBox label="Soul" value={String(soul)} />
        </div>
      </div>
    </TooltipProvider>
  );
}
