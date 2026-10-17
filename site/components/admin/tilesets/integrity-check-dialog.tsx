"use client";

import { useState } from "react";
import useSWR from "swr";
import { ShieldCheck } from "lucide-react";

import { fetcher } from "@/lib/fetcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

type ValidateResponse = {
  tilesetsTotal: number;
  categoriesTotal: number;
  uncategorizedBrushes: { grounds: number; walls: number; doodads: number; total: number };
  unresolvedBrushNames: { total: number; categories: { id: number; name: string; tilesetId: number }[] };
  emptyCategories: { total: number };
  isHealthy: boolean;
};

export function IntegrityCheckDialog() {
  const [open, setOpen] = useState(false);
  const { data } = useSWR<ValidateResponse>(open ? "/api/admin/tilesets/validate" : null, fetcher);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <ShieldCheck className="size-4" />
            Verificar integridade
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Integridade do sistema de Tilesets</DialogTitle>
          <DialogDescription>
            Checagem de segurança extra — o schema e as rotas de API já impedem a maioria
            desses problemas.
          </DialogDescription>
        </DialogHeader>

        {!data ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        ) : (
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant={data.isHealthy ? "default" : "destructive"}>
                {data.isHealthy ? "Saudável" : "Precisa de atenção"}
              </Badge>
              <span className="text-muted-foreground">
                {data.tilesetsTotal} tileset(s), {data.categoriesTotal} categoria(s)
              </span>
            </div>

            <div className="flex justify-between">
              <span>Brushes sem categoria</span>
              <span className={data.uncategorizedBrushes.total > 0 ? "font-medium text-destructive" : ""}>
                {data.uncategorizedBrushes.total} (grounds {data.uncategorizedBrushes.grounds}, walls{" "}
                {data.uncategorizedBrushes.walls}, doodads {data.uncategorizedBrushes.doodads})
              </span>
            </div>

            <div className="flex justify-between">
              <span>Nomes de brush não resolvidos (import)</span>
              <span className={data.unresolvedBrushNames.total > 0 ? "font-medium text-destructive" : ""}>
                {data.unresolvedBrushNames.total}
              </span>
            </div>

            <div className="flex justify-between">
              <span>Categorias vazias</span>
              <span className="text-muted-foreground">{data.emptyCategories.total}</span>
            </div>

            {data.unresolvedBrushNames.categories.length > 0 && (
              <div>
                <p className="mb-1 font-medium">Categorias com nomes não resolvidos:</p>
                <ul className="list-inside list-disc text-muted-foreground">
                  {data.unresolvedBrushNames.categories.map((c) => (
                    <li key={c.id}>{c.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
