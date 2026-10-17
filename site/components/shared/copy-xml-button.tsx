"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

type CopyXmlButtonProps = {
  /**
   * Retorna o texto a copiar — pode buscar de uma rota (lista) ou usar um preview já calculado (form).
   * Não pode ser passado de um Server Component (funções não são serializáveis pelo RSC) — nesse
   * caso use `endpoint` em vez disso.
   */
  getText?: () => string | Promise<string>;
  /** Rota GET que retorna o XML como texto — alternativa a `getText` segura para uso a partir de
   * Server Components (páginas de edição), já que só recebe uma string como prop. */
  endpoint?: string;
  label?: string;
  /**
   * "header": botão com rótulo, para o cabeçalho de telas de listagem ou de edição.
   * "icon": botão compacto para a coluna de ações da listagem, copia o XML de um registro específico.
   * "menuitem": item de menu para o dropdown "3 pontinhos" da coluna de ações.
   */
  variant?: "header" | "icon" | "menuitem";
};

/** Botão genérico "Copiar XML": copia direto pro clipboard sem precisar baixar o arquivo. */
export function CopyXmlButton({
  getText,
  endpoint,
  label = "Copiar XML",
  variant = "header",
}: CopyXmlButtonProps) {
  const [copied, setCopied] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  async function handleClick() {
    setIsCopying(true);

    try {
      const text = getText
        ? await getText()
        : await fetch(endpoint as string).then((response) => response.text());
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("XML copiado para a área de transferência.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o XML.");
    } finally {
      setIsCopying(false);
    }
  }

  if (variant === "menuitem") {
    return (
      <DropdownMenuItem onClick={handleClick} disabled={isCopying}>
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {label}
      </DropdownMenuItem>
    );
  }

  if (variant === "icon") {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={handleClick}
        disabled={isCopying}
        title={label}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </Button>
    );
  }

  return (
    <Button type="button" variant="outline" onClick={handleClick} disabled={isCopying}>
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {label}
    </Button>
  );
}
