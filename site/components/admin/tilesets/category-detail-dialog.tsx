"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ExternalLink, Search } from "lucide-react";

import { fetcher } from "@/lib/fetcher";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CategoryRow } from "@/components/admin/tilesets/category-item";
import { CategoryItemEntriesEditor } from "@/components/admin/tilesets/category-item-entries-editor";
import { CategoryBrushOrderList } from "@/components/admin/tilesets/category-brush-order-list";

type BrushRef = { id: number; name: string; tilesetOrder: number };

type CategoryDetailResponse = {
  category: {
    grounds: BrushRef[];
    walls: BrushRef[];
    doodads: BrushRef[];
  };
};

type CategoryDetailDialogProps = {
  category: CategoryRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
};

function BrushLinkList({ title, items, href }: { title: string; items: BrushRef[]; href: (id: number) => string }) {
  if (items.length === 0) return null;

  return (
    <div>
      <p className="mb-1 text-sm font-medium text-muted-foreground">
        {title} ({items.length})
      </p>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={href(item.id)}
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              {item.name}
              <ExternalLink className="size-3" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function filterBrushes(items: BrushRef[], search: string): BrushRef[] {
  const term = search.trim().toLowerCase();
  if (term === "") return items;
  return items.filter(
    (item) => String(item.id).includes(term) || item.name.toLowerCase().includes(term)
  );
}

export function CategoryDetailDialog({ category, open, onOpenChange, onChanged }: CategoryDetailDialogProps) {
  const { data, mutate } = useSWR<CategoryDetailResponse>(
    category.type === "BRUSH" && open ? `/api/admin/tilesets/categories/${category.id}` : null,
    fetcher
  );

  function refresh() {
    mutate();
    onChanged();
  }
  const [search, setSearch] = useState("");
  const [brushOrderDirty, setBrushOrderDirty] = useState(false);

  const grounds = filterBrushes(data?.category.grounds ?? [], search);
  const walls = filterBrushes(data?.category.walls ?? [], search);
  const doodads = filterBrushes(data?.category.doodads ?? [], search);
  const hasAnyBrush =
    (data?.category.grounds.length ?? 0) + (data?.category.walls.length ?? 0) + (data?.category.doodads.length ?? 0) > 0;
  const hasFilteredResults = grounds.length + walls.length + doodads.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal={brushOrderDirty}>
      <DialogContent className="flex h-[90vh] max-h-[90vh] w-[90vw] max-w-[90vw] flex-col overflow-y-auto sm:max-w-[90vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {category.name}
            <Badge variant={category.type === "BRUSH" ? "default" : "secondary"}>{category.type}</Badge>
          </DialogTitle>
          <DialogDescription>
            {category.type === "BRUSH"
              ? "Brushes vinculados a esta categoria — edite-os nos CRUDs de Ground/Wall/Doodad; a categoria é sincronizada automaticamente. Arraste pelo ícone para reordenar e clique em \"Salvar ordem\" — essa ordem é a que sai ao exportar/copiar o XML. Também é possível soltar ids de item avulsos, sem brush."
              : "Entradas de item (ID único ou intervalo) desta categoria."}
          </DialogDescription>
        </DialogHeader>

        {category.type === "BRUSH" ? (
          <div className="flex flex-col gap-4">
            {hasAnyBrush && (
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pesquisar por ID ou nome..."
                  className="pl-8"
                />
              </div>
            )}

            {search.trim() === "" ? (
              <CategoryBrushOrderList
                key={category.id}
                categoryId={category.id}
                grounds={data?.category.grounds ?? []}
                walls={data?.category.walls ?? []}
                doodads={data?.category.doodads ?? []}
                onSaved={refresh}
                onDirtyChange={setBrushOrderDirty}
              />
            ) : (
              <>
                <BrushLinkList title="Grounds" items={grounds} href={(id) => `/admin/grounds/${id}`} />
                <BrushLinkList title="Walls" items={walls} href={(id) => `/admin/walls/${id}`} />
                <BrushLinkList title="Doodads" items={doodads} href={(id) => `/admin/doodads/${id}`} />
              </>
            )}

            {data && !hasAnyBrush && (
              <p className="text-sm text-muted-foreground">
                Nenhum brush vinculado ainda. Associe pelo campo &quot;Categoria do Tileset&quot; no form de
                Ground/Wall/Doodad.
              </p>
            )}
            {data && hasAnyBrush && !hasFilteredResults && (
              <p className="text-sm text-muted-foreground">Nenhum brush encontrado para &quot;{search}&quot;.</p>
            )}

            <div className="border-t pt-4">
              <p className="mb-2 text-sm font-medium text-muted-foreground">
                Item ids avulsos (sem brush)
              </p>
              <CategoryItemEntriesEditor categoryId={category.id} onChanged={onChanged} />
            </div>
          </div>
        ) : (
          <CategoryItemEntriesEditor categoryId={category.id} onChanged={onChanged} />
        )}

        <DialogFooter className="sm:justify-center">
          <DialogClose render={<Button variant="outline" />}>Fechar</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
