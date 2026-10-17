"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { EntityImageType } from "@/lib/entity-image";
import type { Looktype } from "@/lib/generated/prisma/client";
import { LOOKTYPE_CATEGORY_LABELS, formatLooktypeOption, type LooktypeCategory } from "@/lib/validations/admin/looktype";
import { Button } from "@/components/ui/button";
import { EntityThumb } from "@/components/shared/entity-thumb";
import { EntitySearchCombobox } from "@/components/shared/entity-search-combobox";
import { LooktypeAnimatedImage } from "@/components/shared/looktype-animated-image";
import type { EntityImageInfo } from "@/components/shared/use-entity-images";

type EntityImageUploadProps = {
  entityType: EntityImageType;
  id: number;
  name?: string;
  currentImage?: EntityImageInfo | null;
  /** Notifica o caller (ex.: `EntityImageUploadDialog`) sempre que um upload/vínculo entra ou
   * sai de andamento — usado para só bloquear o fechamento do dialog por clique fora enquanto
   * uma requisição está de fato em voo. */
  onBusyChange?: (busy: boolean) => void;
  /** Chamado após vincular uma looktype com sucesso — para forms que guardam o `lookTypeId` em
   * estado próprio manterem o valor em sincronia (senão o Salvar reenvia o id antigo). */
  onLooktypeLinked?: (looktypeId: number) => void;
  /** Chamado após qualquer mudança persistida (upload, remoção ou vínculo) — para previews fora
   * deste componente se atualizarem sem precisar salvar o form. */
  onChanged?: () => void;
  /** Looktype candidata a auto-vínculo (ex.: achada por convenção de nome a partir do client id
   * digitado no form) — só é aplicada automaticamente enquanto a entidade ainda não tiver
   * imagem/looktype vinculada, pra nunca sobrescrever uma escolha manual do admin. */
  autoLinkCandidate?: Looktype | null;
};

/** Upload imediato (independente do resto do form — a entidade já precisa existir, então esta
 * seção só aparece em modo de edição, nunca em "novo"). */
export function EntityImageUpload({
  entityType,
  id,
  name,
  currentImage,
  onBusyChange,
  onLooktypeLinked,
  onChanged,
  autoLinkCandidate,
}: EntityImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<EntityImageInfo | null | undefined>(currentImage);
  const [isUploading, setIsUploading] = useState(false);
  const [showLooktypePicker, setShowLooktypePicker] = useState(false);

  useEffect(() => {
    onBusyChange?.(isUploading);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage a mudanças de `isUploading`, `onBusyChange` não deve reexecutar o efeito
  }, [isUploading]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`/api/admin/images/${entityType}/${id}`, {
      method: "POST",
      body: formData,
    });

    setIsUploading(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      toast.error(data?.error ?? "Não foi possível enviar a imagem.");
      return;
    }

    const data = await response.json();
    setImage({ extension: data.image.extension, updatedAt: data.image.updatedAt, looktype: data.image.looktype ?? null });
    onChanged?.();
    toast.success("Imagem atualizada.");
  }

  async function handleRemove() {
    setIsUploading(true);
    const response = await fetch(`/api/admin/images/${entityType}/${id}`, { method: "DELETE" });
    setIsUploading(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      toast.error(data?.error ?? "Não foi possível remover a imagem.");
      return;
    }

    setImage(null);
    onChanged?.();
    toast.success("Imagem removida.");
  }

  async function handleLinkLooktype(looktype: Looktype | null) {
    if (!looktype) return;

    setIsUploading(true);
    const response = await fetch(`/api/admin/images/${entityType}/${id}/link-looktype`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ looktypeId: looktype.id }),
    });
    setIsUploading(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      toast.error(data?.error ?? "Não foi possível vincular a sprite.");
      return;
    }

    const data = await response.json();
    setImage({ extension: data.image.extension, updatedAt: data.image.updatedAt, looktype: data.image.looktype });
    setShowLooktypePicker(false);
    onLooktypeLinked?.(looktype.id);
    onChanged?.();
    toast.success("Sprite vinculada a partir do cadastro de looktypes.");
  }

  useEffect(() => {
    // Sem checar `image`: o form só manda um `autoLinkCandidate` novo quando o client id
    // realmente mudou e uma nova busca achou sprite — nesse caso o vínculo antigo (se houver)
    // deixou de fazer sentido e deve ser substituído, não preservado.
    if (!autoLinkCandidate || isUploading) return;
    // setTimeout (e não uma chamada direta) evita que o vínculo automático dispare setState
    // síncrono dentro do corpo do efeito — vira uma chamada em callback, como um `fetch`/timer
    // externo de verdade.
    const timeoutId = setTimeout(() => handleLinkLooktype(autoLinkCandidate), 0);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage a mudanças do candidato; `image`/`isUploading` só decidem se a chamada roda, não devem reexecutar o efeito
  }, [autoLinkCandidate]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <EntityThumb entityType={entityType} id={id} name={name} size="md" image={image} />
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
          >
            {isUploading ? "Enviando..." : image ? "Trocar imagem" : "Enviar imagem"}
          </Button>
          {image && (
            <Button type="button" variant="ghost" size="sm" disabled={isUploading} onClick={handleRemove}>
              Remover imagem
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isUploading}
            onClick={() => setShowLooktypePicker((v) => !v)}
          >
            Vincular sprite do cadastro
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".obd,image/png,image/gif"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
      {showLooktypePicker && (
        <EntitySearchCombobox<Looktype>
          endpoint="/api/admin/looktypes"
          value={null}
          placeholder="Buscar sprite/looktype por id ou número..."
          formatOption={(lt) =>
            `${formatLooktypeOption(lt)} — ${LOOKTYPE_CATEGORY_LABELS[lt.category as LooktypeCategory] ?? lt.category}`
          }
          renderOption={(lt) => (
            <span className="flex items-center gap-2">
              <LooktypeAnimatedImage
                key={lt.id}
                looktypeId={lt.id}
                frameCount={lt.frameCount}
                frameDurationsMs={lt.frameDurationsMs as number[]}
                updatedAt={lt.updatedAt}
                size="sm"
              />
              {formatLooktypeOption(lt)} — {LOOKTYPE_CATEGORY_LABELS[lt.category as LooktypeCategory] ?? lt.category}
            </span>
          )}
          onSelect={handleLinkLooktype}
        />
      )}
      <p className="text-xs text-muted-foreground">
        PNG ou GIF (até 2MB) ficam estáticos. Envie um `.obd` do Object Builder (até 8MB) para animação
        automática — cria/atualiza uma sprite no cadastro de looktypes e vincula por baixo dos panos.
      </p>
    </div>
  );
}
