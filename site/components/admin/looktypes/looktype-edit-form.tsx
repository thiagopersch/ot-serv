"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { Looktype } from "@/lib/generated/prisma/client";
import { looktypeSchema, type LooktypeCategory } from "@/lib/validations/admin/looktype";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LooktypeCategoryFields } from "@/components/admin/looktypes/looktype-category-fields";
import { LooktypeUsagePanel } from "@/components/admin/looktypes/looktype-usage-panel";
import { LooktypeAnimatedImage } from "@/components/shared/looktype-animated-image";

/** Form de edição em página (não dialog) — o seletor de arquivo nativo do SO tira o foco da
 * janela ao trocar a imagem, e um dialog nesse cenário corria risco de fechar sozinho
 * dependendo do timing (ver histórico em `looktype-form-dialog.tsx`, removido). Uma página
 * normal não tem esse problema, já que não existe popup/focus-trap pra "fechar". */
export function LooktypeEditForm({ looktype }: { looktype: Looktype }) {
  const router = useRouter();
  const [name, setName] = useState(looktype.name);
  const [category, setCategory] = useState<LooktypeCategory>(looktype.category as LooktypeCategory);
  const [looktypeNumber, setLooktypeNumber] = useState<number | null>(looktype.looktypeNumber);
  const [currentLooktype, setCurrentLooktype] = useState(looktype);
  const [frameSpeedMs, setFrameSpeedMs] = useState<number>(
    (currentLooktype.frameDurationsMs as number[])[0] ?? 100,
  );
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleReplaceImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("frameSpeedMs", String(frameSpeedMs));

    const response = await fetch(`/api/admin/looktypes/${looktype.id}/image`, {
      method: "POST",
      body: formData,
    });
    setIsUploading(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      toast.error(data?.error ?? "Não foi possível processar o arquivo.");
      return;
    }

    const data = await response.json();
    setCurrentLooktype(data.looktype);
    toast.success("Imagem atualizada.");
  }

  async function handleRemoveImage() {
    setIsUploading(true);
    const response = await fetch(`/api/admin/looktypes/${looktype.id}/image`, { method: "DELETE" });
    setIsUploading(false);

    if (!response.ok) {
      toast.error("Não foi possível remover a imagem.");
      return;
    }

    const data = await response.json();
    setCurrentLooktype(data.looktype);
    toast.success("Imagem removida.");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const parsed = looktypeSchema.safeParse({ name, category, looktypeNumber, frameSpeedMs });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }

    setIsSubmitting(true);
    const response = await fetch(`/api/admin/looktypes/${looktype.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    setIsSubmitting(false);

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(data?.error ?? "Não foi possível salvar.");
      return;
    }

    setCurrentLooktype(data.looktype);
    toast.success("Atualizado com sucesso.");
    router.push("/admin/looktypes");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label>Nome</Label>
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </div>

      <LooktypeCategoryFields
        category={category}
        onCategoryChange={setCategory}
        looktypeNumber={looktypeNumber}
        onLooktypeNumberChange={setLooktypeNumber}
      />

      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label>Largura (px)</Label>
          <Input value={currentLooktype.width * 32} disabled />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label>Altura (px)</Label>
          <Input value={currentLooktype.height * 32} disabled />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label>Velocidade dos quadros (ms)</Label>
          <Input
            type="number"
            min={1}
            max={1000}
            value={frameSpeedMs}
            onChange={(event) => setFrameSpeedMs(Number(event.target.value))}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Imagem</Label>
        <div className="flex items-center gap-3">
          <LooktypeAnimatedImage
            key={currentLooktype.frameCount}
            looktypeId={currentLooktype.id}
            frameCount={currentLooktype.frameCount}
            frameDurationsMs={currentLooktype.frameDurationsMs as number[]}
            updatedAt={currentLooktype.updatedAt}
            size="lg"
          />
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? "Enviando..." : currentLooktype.frameCount > 0 ? "Substituir sprite" : "Enviar sprite"}
            </Button>
            {currentLooktype.frameCount > 0 && (
              <Button type="button" variant="ghost" size="sm" disabled={isUploading} onClick={handleRemoveImage}>
                Remover
              </Button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".obd,image/png,image/gif"
            className="hidden"
            onChange={handleReplaceImage}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Arquivos `.obd` do Object Builder viram animação (outfit anda para o sul; item/efeito/missile ciclam os
          frames). PNG/GIF ficam estáticos.
        </p>
      </div>

      <LooktypeUsagePanel looktypeId={looktype.id} />

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" onClick={() => router.push("/admin/looktypes")}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
