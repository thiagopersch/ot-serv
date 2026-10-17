"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type MultiFileUploadDialogProps = {
  endpoint: string;
  triggerLabel: string;
  title: string;
  description: React.ReactNode;
  accept: string;
  /** Checkbox opcional enviado como `name=true|false` no FormData. */
  option?: { name: string; label: string };
  /** Monta o resumo exibido após o envio a partir da resposta da rota. */
  formatResult: (data: Record<string, unknown>) => { summary: string; details?: string[] };
  onUploaded: () => void;
};

/** Envio de vários arquivos de uma vez (campo `files`), com relatório do que casou ou não. */
export function MultiFileUploadDialog({
  endpoint,
  triggerLabel,
  title,
  description,
  accept,
  option,
  formatResult,
  onUploaded,
}: MultiFileUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [optionChecked, setOptionChecked] = useState(false);
  const [result, setResult] = useState<{ summary: string; details?: string[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    const files = Array.from(inputRef.current?.files ?? []);
    if (files.length === 0) {
      toast.error("Selecione ao menos um arquivo.");
      return;
    }

    const formData = new FormData();
    for (const file of files) formData.append("files", file);
    if (option) formData.append(option.name, String(optionChecked));

    setIsSubmitting(true);
    const response = await fetch(endpoint, { method: "POST", body: formData });
    setIsSubmitting(false);

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      toast.error(data?.error ?? "Não foi possível enviar os arquivos.");
      return;
    }

    const formatted = formatResult(data);
    setResult(formatted);
    toast.success(formatted.summary);
    if (inputRef.current) inputRef.current.value = "";
    onUploaded();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setResult(null);
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline">
            <Upload className="size-4" />
            {triggerLabel}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="multi-file-upload">Arquivos</Label>
            <Input id="multi-file-upload" type="file" multiple accept={accept} ref={inputRef} />
          </div>
          {option && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4"
                checked={optionChecked}
                onChange={(event) => setOptionChecked(event.target.checked)}
              />
              {option.label}
            </label>
          )}
          {result && (
            <div className="rounded-md border p-2 text-sm">
              <p className="font-medium">{result.summary}</p>
              {result.details?.map((line) => (
                <p key={line} className="text-xs text-muted-foreground">
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleUpload} disabled={isSubmitting}>
            {isSubmitting ? "Enviando..." : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
