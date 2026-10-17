"use client";

import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import type { EntityImageType } from "@/lib/entity-image";

export type EntityImageLooktype = {
  id: number;
  frameCount: number;
  frameDurationsMs: number[];
  updatedAt: string;
};

/** `extension`/`updatedAt` só existem quando há um snapshot estático salvo; `looktype`, quando
 * presente, tem prioridade — é a sprite animada do cadastro (ver `EntityThumb`). */
export type EntityImageInfo = {
  extension: string | null;
  updatedAt: string | null;
  looktype: EntityImageLooktype | null;
};

type ImagesResponse = {
  images: { entityId: number; extension: string | null; updatedAt: string | null; looktype: EntityImageLooktype | null }[];
};

/** Lookup em lote — uma chamada por página/tabela (não uma por linha). A chave do SWR é
 * determinística (ids ordenados) para que múltiplos componentes com o mesmo conjunto de ids
 * dedupem naturalmente pelo cache do SWR. */
export function useEntityImages(entityType: EntityImageType, ids: number[]): Map<number, EntityImageInfo> {
  const sortedIds = Array.from(new Set(ids)).sort((a, b) => a - b);
  const key = sortedIds.length > 0 ? `/api/admin/images/${entityType}?ids=${sortedIds.join(",")}` : null;

  const { data } = useSWR<ImagesResponse>(key, fetcher);

  const map = new Map<number, EntityImageInfo>();
  for (const image of data?.images ?? []) {
    map.set(image.entityId, {
      extension: image.extension,
      updatedAt: image.updatedAt,
      looktype: image.looktype,
    });
  }
  return map;
}
