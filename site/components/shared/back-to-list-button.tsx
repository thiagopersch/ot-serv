import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Cores de destaque do "voltar pra listagem" — reaproveitadas pelos botões avulsos de voltar
 * (rodapé de alguns forms) pra ficarem com a mesma aparência em todo o admin. */
export const backToListClassName =
  "bg-primary/15 font-medium text-primary hover:bg-primary hover:text-primary-foreground";

/** Botão de voltar exibido no início de cada form de create/edit do admin — leva de volta pra
 * listagem sem depender do usuário usar o botão "voltar" do navegador. */
export function BackToListButton({ href }: { href: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("w-fit", backToListClassName)}
      nativeButton={false}
      render={<Link href={href} />}
    >
      <ArrowLeft className="size-4" />
      Voltar para a listagem
    </Button>
  );
}
