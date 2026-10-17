"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CopyPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

type DuplicatedRecord = { id: number | string; name: string };

type DuplicateButtonProps = {
  /** Rota POST que cria a cópia, ex.: `/api/admin/vocations/${id}/duplicate`. */
  endpoint: string;
  /** Base da rota de edição do módulo, ex.: `/admin/vocations` (navega para `${editPathBase}/${id}`). */
  editPathBase: string;
  /**
   * "icon": botão compacto para a coluna de ações da listagem.
   * "header": botão com rótulo para o cabeçalho do CRUD em edição.
   * "menuitem": item de menu para o dropdown "3 pontinhos" da coluna de ações.
   * Em todos, duplicar navega automaticamente para o registro recém-criado.
   */
  variant?: "icon" | "header" | "menuitem";
  /** Chamado após duplicar com sucesso, ex.: `mutate()` para atualizar a listagem. */
  onDuplicated?: (record: DuplicatedRecord) => void;
};

export function DuplicateButton({
  endpoint,
  editPathBase,
  variant = "icon",
  onDuplicated,
}: DuplicateButtonProps) {
  const router = useRouter();
  const [isDuplicating, setIsDuplicating] = useState(false);

  async function handleDuplicate() {
    setIsDuplicating(true);
    const response = await fetch(endpoint, { method: "POST" });
    const body = await response.json().catch(() => null);
    setIsDuplicating(false);

    if (!response.ok) {
      toast.error(body?.error ?? "Não foi possível duplicar o registro.");
      return;
    }

    const record: DuplicatedRecord = body;
    toast.success(`Duplicado como "${record.name}".`);
    onDuplicated?.(record);
    router.push(`${editPathBase}/${record.id}`);
  }

  if (variant === "menuitem") {
    return (
      <DropdownMenuItem onClick={handleDuplicate} disabled={isDuplicating}>
        <CopyPlus className="size-4" />
        Duplicar
      </DropdownMenuItem>
    );
  }

  return variant === "icon" ? (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={handleDuplicate}
      disabled={isDuplicating}
      title="Duplicar"
    >
      <CopyPlus className="size-4" />
    </Button>
  ) : (
    <Button type="button" variant="outline" onClick={handleDuplicate} disabled={isDuplicating}>
      <CopyPlus className="size-4" />
      Duplicar
    </Button>
  );
}
