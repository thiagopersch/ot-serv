"use client";

import { useState } from "react";
import { toast } from "sonner";

/** Checkbox de publicação usado nas listagens (items/monstros/spells/vocações) — dispara um
 * PATCH dedicado (`{endpoint}`) que só atualiza `published`, sem precisar abrir o form de
 * edição nem reenviar o registro inteiro (as rotas de edição validam o schema completo). */
export function PublishedToggle({
  endpoint,
  published,
  onToggled,
  hideLabel = false,
}: {
  endpoint: string;
  published: boolean;
  onToggled: () => void;
  /** Mostra só a checkbox (sem o texto Publicado/Não publicado). */
  hideLabel?: boolean;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleChange(checked: boolean) {
    setIsSubmitting(true);

    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: checked }),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      toast.error("Não foi possível atualizar a publicação.");
      return;
    }

    toast.success(checked ? "Publicado." : "Despublicado.");
    onToggled();
  }

  return (
    <label className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap">
      <input
        type="checkbox"
        className="size-4"
        aria-label={published ? "Publicado" : "Não publicado"}
        checked={published}
        disabled={isSubmitting}
        onChange={(event) => handleChange(event.target.checked)}
      />
      {!hideLabel && (
        <span className="text-sm text-muted-foreground">
          {published ? "Publicado" : "Não publicado"}
        </span>
      )}
    </label>
  );
}
