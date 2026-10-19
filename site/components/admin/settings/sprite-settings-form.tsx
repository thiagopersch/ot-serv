"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import { HD_SPRITES_SETTINGS_URL } from "@/lib/sprite-hd";
import type { SpriteSettingsFormInput } from "@/lib/validations/admin/sprite-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export function SpriteSettingsForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data, isLoading } = useSWR<SpriteSettingsFormInput>("/api/admin/sprite-settings", fetcher);
  // Valor editado pelo usuário; até mexer no checkbox mostra o que está salvo.
  const [draft, setDraft] = useState<boolean | null>(null);
  const hdSprites = draft ?? data?.hdSprites ?? true;

  async function onSubmit() {
    setIsSubmitting(true);

    const response = await fetch("/api/admin/sprite-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hdSprites } satisfies SpriteSettingsFormInput),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      toast.error("Não foi possível salvar.");
      return;
    }

    await mutate(HD_SPRITES_SETTINGS_URL, { hdSprites }, { revalidate: false });
    toast.success("Configurações salvas.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sprites</CardTitle>
      </CardHeader>
      <CardContent>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 size-4"
            checked={hdSprites}
            disabled={isLoading || isSubmitting}
            onChange={(event) => setDraft(event.target.checked)}
          />
          <span className="flex flex-col gap-1">
            <span className="text-sm font-medium">HD Mode (xBRZ 2x)</span>
            <span className="text-sm text-muted-foreground">
              Amplia as sprites e looktypes 2x com xBRZ, igual ao HD Mode do cliente. As máscaras de cor
              das outfits usam nearest-neighbour. A versão HD é gerada na primeira exibição e fica em
              cache em <code>public/storage/hd</code>.
            </span>
          </span>
        </label>
      </CardContent>
      <CardFooter className="justify-end">
        <Button type="button" disabled={isSubmitting || isLoading} onClick={onSubmit}>
          {isSubmitting ? "Salvando..." : "Salvar"}
        </Button>
      </CardFooter>
    </Card>
  );
}
