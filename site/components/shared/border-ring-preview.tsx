"use client";

import { useEntityImages } from "@/components/shared/use-entity-images";
import { EntityThumb } from "@/components/shared/entity-thumb";
import type { BorderEdge } from "@/lib/validations/admin/border";

type BorderRingPreviewProps = {
  /** Sprite central (o item principal do ground/tile) — omitido no preview de um Border em
   * si, já que Border não tem um item "principal" próprio. */
  center?: { id: number; label: string } | null;
  /** `edge` (n/e/s/w/c*) -> item id, como em `Border.edges`. */
  edges: Partial<Record<BorderEdge, number>>;
};

const OUTER_GRID: (BorderEdge | "center" | null)[] = [
  "cnw", "n", "cne",
  "w", "center", "e",
  "csw", "s", "cse",
];

const INNER_EDGES: BorderEdge[] = ["dnw", "dne", "dse", "dsw"];

function Cell({
  itemId,
  label,
  images,
}: {
  itemId: number | undefined;
  label: string;
  images: ReturnType<typeof useEntityImages>;
}) {
  if (!itemId || itemId <= 0) {
    return (
      <div className="flex size-16 items-center justify-center rounded-sm border border-dashed border-border/60" />
    );
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <EntityThumb entityType="item" id={itemId} size="lg" image={images.get(itemId) ?? null} />
      <span className="text-[9px] text-muted-foreground">{label}</span>
    </div>
  );
}

/** Simula visualmente a "moldura" de um border: o item principal (`center`) rodeado pelas 8
 * sprites de borda externa (n/e/s/w + cantos) na mesma disposição espacial do tileset, com os
 * 4 cantos internos (côncavos) listados abaixo. Usado no CRUD de Ground (border resolvido a
 * partir do `borderId` vinculado) e no próprio CRUD de Border (edges do form atual). */
export function BorderRingPreview({ center, edges }: BorderRingPreviewProps) {
  const allIds = [
    ...(center ? [center.id] : []),
    ...Object.values(edges).filter((id): id is number => Boolean(id && id > 0)),
  ];
  const images = useEntityImages("item", allIds);

  const hasAnyEdge = Object.values(edges).some((id) => id && id > 0);
  if (!center && !hasAnyEdge) {
    return <p className="text-sm text-muted-foreground">Nenhuma sprite configurada ainda.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid w-fit grid-cols-3 gap-1">
        {OUTER_GRID.map((slot, index) => {
          if (slot === "center") {
            return center ? (
              <Cell key={index} itemId={center.id} label={center.label} images={images} />
            ) : (
              <div key={index} className="size-16" />
            );
          }
          return <Cell key={index} itemId={slot ? edges[slot] : undefined} label={slot ?? ""} images={images} />;
        })}
      </div>

      {INNER_EDGES.some((edge) => edges[edge]) && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Cantos internos</p>
          <div className="flex gap-2">
            {INNER_EDGES.map((edge) => (
              <Cell key={edge} itemId={edges[edge]} label={edge} images={images} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
