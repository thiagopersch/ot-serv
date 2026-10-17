"use client";

import { ChevronDown } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleTrigger, CollapsiblePanel } from "@/components/ui/collapsible";
import { CopyXmlButton } from "@/components/shared/copy-xml-button";
import { XmlCodeViewer } from "@/components/shared/xml-code-viewer";

type XmlPreviewCardProps = {
  value: string;
  title?: string;
  className?: string;
  maxHeight?: string;
};

/** Card de pré-visualização de XML recolhível (fechado por padrão) com botão de copiar —
 * padrão único para todos os forms que mostram o XML gerado (Spell/Monster/Vocation/Item/
 * Movement/Ground/Border/Wall/Doodad). */
export function XmlPreviewCard({
  value,
  title = "Pré-visualização do XML",
  className,
  maxHeight,
}: XmlPreviewCardProps) {
  return (
    <Card className={className ?? "h-fit"}>
      <Collapsible defaultOpen={false}>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CollapsibleTrigger className="flex-1 justify-between">
            <CardTitle>{title}</CardTitle>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 data-panel-open:rotate-180" />
          </CollapsibleTrigger>
          <CopyXmlButton getText={() => value} />
        </CardHeader>
        <CollapsiblePanel>
          <CardContent>
            <XmlCodeViewer value={value} maxHeight={maxHeight} />
          </CardContent>
        </CollapsiblePanel>
      </Collapsible>
    </Card>
  );
}
