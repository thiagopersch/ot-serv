"use client";

import { useState } from "react";
import { mutate as mutateGlobal } from "swr";
import { ImageUp } from "lucide-react";

import type { EntityImageType } from "@/lib/entity-image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EntityImageUpload } from "@/components/shared/entity-image-upload";
import type { EntityImageInfo } from "@/components/shared/use-entity-images";

type EntityImageUploadDialogProps = {
  entityType: EntityImageType;
  id: number;
  name?: string;
  image?: EntityImageInfo | null;
  onUploaded?: () => void;
  /** Elemento customizado para abrir o dialog (ex.: um `DropdownMenuItem` no menu de ações da
   * listagem). Se omitido, usa o botão padrão de ícone. */
  trigger?: React.ReactNode;
};

/** Upload de imagem sem sair da listagem — usado na coluna de ações das tabelas de admin
 * (item, monster, spell, vocation) como atalho para não precisar entrar na tela de edição. */
export function EntityImageUploadDialog({
  entityType,
  id,
  name,
  image,
  onUploaded,
  trigger,
}: EntityImageUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  function handleClose() {
    setOpen(false);
    onUploaded?.();
    // Revalida o cache batelado de imagens (`useEntityImages`, usado pelo `EntityThumb` nas
    // tabelas de admin) para o entityType desta instância — sem isso a sprite recém enviada ou
    // vinculada só aparece atualizada na tabela após um refresh manual da página, já que esse
    // cache é independente do `onUploaded` (que revalida a listagem em si, não as imagens).
    mutateGlobal((key) => typeof key === "string" && key.startsWith(`/api/admin/images/${entityType}`));
  }

  return (
    <Dialog
      open={open}
      // Bloqueia fechamento por clique/foco fora do dialog só enquanto uma requisição está de
      // fato em andamento (`busy`, reportado por `EntityImageUpload` via `onBusyChange`) — o
      // seletor de arquivo nativo do SO tira o foco da janela e o base-ui, dependendo do timing,
      // pode interpretar isso de formas diferentes (focus-out, outside-press, ou outra variante
      // interna) como um fechamento, perdendo o upload em andamento. Fora de um upload/vínculo
      // em voo, clicar fora deve fechar e revalidar normalmente.
      disablePointerDismissal={busy}
      onOpenChange={(next, eventDetails) => {
        if (busy && (eventDetails?.reason === "focus-out" || eventDetails?.reason === "outside-press")) return;
        if (!next) {
          handleClose();
          return;
        }
        setOpen(next);
      }}
    >
      <DialogTrigger
        // Triggers customizados (ex.: `DropdownMenuItem`) não renderizam um <button> nativo.
        nativeButton={!trigger}
        render={
          (trigger as React.ReactElement) ?? (
            <Button variant="ghost" size="icon-sm" title="Enviar/trocar imagem">
              <ImageUp className="size-4" />
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Imagem — {name ? `${name} (#${id})` : `#${id}`}</DialogTitle>
          <DialogDescription>
            Envie ou troque a imagem sem precisar abrir a edição completa.
          </DialogDescription>
        </DialogHeader>
        <EntityImageUpload
          entityType={entityType}
          id={id}
          name={name}
          currentImage={image}
          onBusyChange={setBusy}
        />
      </DialogContent>
    </Dialog>
  );
}
