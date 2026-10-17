"use client";

import { useEntityImages } from "@/components/shared/use-entity-images";
import { EntityThumb } from "@/components/shared/entity-thumb";

export type SpritePreviewEntry = { id: number; label: string };

type EntitySpritePreviewProps = {
  items: SpritePreviewEntry[];
  emptyMessage?: string;
};

/** Grid simples com todas as sprites (de item) usadas na configuração atual do cadastro —
 * sempre recalculada a partir do form em tempo real (mesmo dado que gera o preview do XML
 * ao lado), não apenas dos ids já salvos. */
export function EntitySpritePreview({
  items,
  emptyMessage = "Nenhuma sprite configurada ainda.",
}: EntitySpritePreviewProps) {
  const images = useEntityImages(
    "item",
    items.map((item) => item.id)
  );

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="flex flex-wrap gap-3">
      {items.map((item, index) => (
        <div key={`${item.id}-${index}`} className="flex flex-col items-center gap-1">
          <EntityThumb entityType="item" id={item.id} size="lg" image={images.get(item.id) ?? null} />
          <span className="max-w-16 truncate text-center text-[10px] text-muted-foreground" title={item.label}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
