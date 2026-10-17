"use client";

import Link from "next/link";
import useSWR from "swr";
import { Download, Plus } from "lucide-react";

import { fetcher } from "@/lib/fetcher";
import type { TilesetFormInput } from "@/lib/validations/admin/tileset";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { backToListClassName } from "@/components/shared/back-to-list-button";
import { TilesetForm } from "@/components/admin/tilesets/tileset-form";
import { TilesetDeleteButton } from "@/components/admin/tilesets/tileset-delete-button";
import { CategoryFormDialog } from "@/components/admin/tilesets/category-form-dialog";
import { CategoryList } from "@/components/admin/tilesets/category-list";
import type { CategoryRow } from "@/components/admin/tilesets/category-item";

type TilesetDetailResponse = { tileset: TilesetFormInput & { id: number; _count: { categories: number } } };
type CategoriesResponse = { categories: CategoryRow[] };

export function TilesetDetail({ tilesetId }: { tilesetId: number }) {
  const { data: tilesetData, mutate: mutateTileset } = useSWR<TilesetDetailResponse>(
    `/api/admin/tilesets/${tilesetId}`,
    fetcher
  );
  const { data: categoriesData, mutate: mutateCategories } = useSWR<CategoriesResponse>(
    `/api/admin/tilesets/${tilesetId}/categories`,
    fetcher
  );

  const tileset = tilesetData?.tileset;
  const categories = categoriesData?.categories ?? [];

  function refreshAll() {
    mutateTileset();
    mutateCategories();
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Dados do tileset</CardTitle>
        </CardHeader>
        <CardContent>
          {tileset && <TilesetForm tilesetId={tilesetId} initialValues={tileset} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Categorias</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href={`/api/admin/tilesets/export?ids=${tilesetId}`} />}
            >
              <Download className="size-4" />
              Exportar XML
            </Button>
            <CategoryFormDialog
              tilesetId={tilesetId}
              nextOrder={categories.length}
              onSaved={refreshAll}
              trigger={
                <Button>
                  <Plus className="size-4" />
                  Nova categoria
                </Button>
              }
            />
          </div>
        </CardHeader>
        <CardContent>
          <CategoryList tilesetId={tilesetId} categories={categories} onChanged={refreshAll} />
        </CardContent>
      </Card>

      {tileset && (
        <div className="flex justify-between">
          <Button
            variant="ghost"
            className={backToListClassName}
            nativeButton={false}
            render={<Link href="/admin/tilesets" />}
          >
            Voltar para a lista
          </Button>
          <TilesetDeleteButton
            tilesetId={tilesetId}
            tilesetName={tileset.name}
            categoryCount={tilesetData?.tileset._count.categories ?? categories.length}
          />
        </div>
      )}
    </div>
  );
}
