"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TilesetOption = { id: number; name: string };

type TilesetDeleteButtonProps = {
  tilesetId: number;
  tilesetName: string;
  categoryCount: number;
};

export function TilesetDeleteButton({ tilesetId, tilesetName, categoryCount }: TilesetDeleteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const needsTarget = categoryCount > 0;

  const { data } = useSWR<PaginatedResult<TilesetOption>>(
    needsTarget && open ? "/api/admin/tilesets?pageSize=200" : null,
    fetcher
  );

  const options = (data?.data ?? []).filter((t) => t.id !== tilesetId);

  async function handleDelete() {
    if (needsTarget && target == null) {
      toast.error("Selecione um tileset de destino para mover as categorias.");
      return;
    }

    setIsSubmitting(true);
    const url = needsTarget
      ? `/api/admin/tilesets/${tilesetId}?moveCategoriesTo=${target}`
      : `/api/admin/tilesets/${tilesetId}`;

    const response = await fetch(url, { method: "DELETE" });
    setIsSubmitting(false);
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(body?.error ?? "Não foi possível remover o tileset.");
      return;
    }

    toast.success("Tileset removido.");
    router.push("/admin/tilesets");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="destructive">
            <Trash2 className="size-4" />
            Excluir tileset
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remover tileset &quot;{tilesetName}&quot;</DialogTitle>
          <DialogDescription>
            {needsTarget
              ? `Este tileset tem ${categoryCount} categoria(s) vinculada(s). Escolha para onde mover antes de excluir.`
              : "Esta ação não pode ser desfeita."}
          </DialogDescription>
        </DialogHeader>

        {needsTarget && (
          <Select value={target != null ? String(target) : undefined} onValueChange={(v) => setTarget(v ? Number(v) : null)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Tileset de destino..." />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.id} value={String(option.id)}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <DialogFooter>
          <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
            {isSubmitting ? "Removendo..." : "Remover"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
