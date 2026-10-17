"use client";

import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import { UncategorizedSection } from "@/components/admin/tilesets/uncategorized-section";
import { Skeleton } from "@/components/ui/skeleton";

type BrushRef = { id: number; name: string };
type UncategorizedResponse = { grounds: BrushRef[]; walls: BrushRef[]; doodads: BrushRef[] };

export default function UncategorizedBrushesPage() {
  const { data, mutate, isLoading } = useSWR<UncategorizedResponse>("/api/admin/tilesets/uncategorized", fetcher);

  const total = (data?.grounds.length ?? 0) + (data?.walls.length ?? 0) + (data?.doodads.length ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Brushes sem categoria</h1>
        <p className="text-muted-foreground">
          Ground/Wall/Doodad criados antes deste sistema de categorias (ou importados sem
          resolver) ainda não pertencem a nenhuma categoria de tileset. Selecione e atribua em
          massa abaixo.
        </p>
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      )}

      {!isLoading && total === 0 && (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhum brush sem categoria. Tudo certo.
        </p>
      )}

      {data && data.grounds.length > 0 && (
        <UncategorizedSection brushKind="ground" items={data.grounds} onAssigned={() => mutate()} />
      )}
      {data && data.walls.length > 0 && (
        <UncategorizedSection brushKind="wall" items={data.walls} onAssigned={() => mutate()} />
      )}
      {data && data.doodads.length > 0 && (
        <UncategorizedSection brushKind="doodad" items={data.doodads} onAssigned={() => mutate()} />
      )}
    </div>
  );
}
