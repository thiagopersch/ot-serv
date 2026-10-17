"use client";

import { useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleTrigger, CollapsiblePanel } from "@/components/ui/collapsible";
import { LuaCodeEditor } from "@/components/shared/lua-code-editor";

type LuaScriptPreviewCardProps = {
  value: string;
  title?: string;
  className?: string;
};

/** Card de pré-visualização do conteúdo `.lua` que será gravado em disco — mesmo padrão visual
 * de `XmlPreviewCard` (recolhível, fechado por padrão, botão de copiar), mas com highlighting de
 * Lua (`LuaCodeEditor` em modo somente leitura) em vez de XML. */
export function LuaScriptPreviewCard({
  value,
  title = "Pré-visualização do Script Lua",
  className,
}: LuaScriptPreviewCardProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Script copiado para a área de transferência.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o script.");
    }
  }

  return (
    <Card className={className ?? "h-fit"}>
      <Collapsible defaultOpen={false}>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CollapsibleTrigger className="flex-1 justify-between">
            <CardTitle>{title}</CardTitle>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 data-panel-open:rotate-180" />
          </CollapsibleTrigger>
          <Button type="button" variant="outline" onClick={handleCopy}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            Copiar Script
          </Button>
        </CardHeader>
        <CollapsiblePanel>
          <CardContent>
            <LuaCodeEditor value={value} onChange={() => {}} readOnly minHeight="0" />
          </CardContent>
        </CollapsiblePanel>
      </Collapsible>
    </Card>
  );
}
