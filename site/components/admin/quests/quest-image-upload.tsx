"use client";

import { useRef, useState } from "react";
import { ImageOff, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type QuestImageUploadProps = {
  questId: number;
  imageUrl: string | null;
  onChange: () => void;
};

export function QuestImageUpload({ questId, imageUrl, onChange }: QuestImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleFile(file: File) {
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`/api/admin/quests/${questId}/media`, {
      method: "POST",
      body: formData,
    });
    setIsUploading(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      toast.error(body?.error ?? "Não foi possível enviar a imagem.");
      return;
    }

    toast.success("Imagem atualizada.");
    onChange();
  }

  async function handleRemove() {
    const response = await fetch(`/api/admin/quests/${questId}/media`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Não foi possível remover a imagem.");
      return;
    }
    toast.success("Imagem removida.");
    onChange();
  }

  return (
    <div className="flex items-center gap-2">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- thumbnail pequena, servida estática de public/storage
        <img
          src={imageUrl}
          alt=""
          className="size-10 shrink-0 rounded-sm border border-border object-cover"
        />
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-sm border border-dashed border-border text-muted-foreground">
          <ImageOff className="size-4" />
        </span>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/gif,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) handleFile(file);
          event.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        title="Enviar imagem"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-4" />
      </Button>
      {imageUrl && (
        <Button
          type="button"
          variant="destructive"
          size="icon-sm"
          title="Remover imagem"
          onClick={handleRemove}
        >
          <Trash2 className="size-4" />
        </Button>
      )}
    </div>
  );
}
